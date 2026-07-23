<#
.SYNOPSIS
Audits, removes or restores files used by the old native GUI or the new standalone SirK Portal.

.DESCRIPTION
The script discovers both GUI dependency graphs from the real runtime entry points:

- Old: browser assets loaded by plugin-main.js (native MeshCentral GUI integration).
- New: assets loaded by public/portal-standalone.html and public/portal-login.html.

Scope Exclusive removes only files that are not used by the other GUI.
Scope Full removes the complete selected graph, including shared assets.

Before Remove, the script creates a directory backup, ZIP archive and manifest.
It also writes reports showing references to selected assets and usages of legacy
layout classes that remain in the plugin.

The script does not restart MeshCentral.

.EXAMPLE
.	ools\Test-PortalGuiIsolation.ps1 -Portal Old -Action Audit

.EXAMPLE
.	ools\Test-PortalGuiIsolation.ps1 -Portal Old -Action Remove -Scope Exclusive -RootPath 'C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\MyCompany' -Force

.EXAMPLE
.	ools\Test-PortalGuiIsolation.ps1 -Portal New -Action Remove -Scope Full -RootPath 'C:\Program Files\Open Source\MeshCentral\meshcentral-data\plugins\MyCompany' -WhatIf

.EXAMPLE
.	ools\Test-PortalGuiIsolation.ps1 -Portal Old -Action Restore -BackupPath 'D:\MyCompany-PortalGuiBackups\20260723-190000-Old-Exclusive' -Force
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Old', 'New')]
    [string]$Portal,

    [ValidateSet('Audit', 'Remove', 'Restore')]
    [string]$Action = 'Audit',

    [ValidateSet('Exclusive', 'Full')]
    [string]$Scope = 'Exclusive',

    [string]$RootPath = (Get-Location).Path,

    [string]$BackupRoot,

    [string]$BackupPath,

    [string]$ReportPath,

    [switch]$Force,

    [ValidateSet('Json', 'Object')]
    [string]$OutputFormat = 'Object'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:ExitCode = 0

function Normalize-RelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $value = $Path.Replace('\', '/').Trim()
    while ($value.StartsWith('./', [System.StringComparison]::Ordinal)) {
        $value = $value.Substring(2)
    }
    return $value.TrimStart([char[]]@('/', '\'))
}

function Get-FullPath {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $nativeRelative = (Normalize-RelativePath -Path $RelativePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
    return [IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $nativeRelative))
}

function Test-PathInsideRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Candidate
    )

    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $candidateFull = [IO.Path]::GetFullPath($Candidate)
    if ($candidateFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar
    return $candidateFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-RelativeFromRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$FullPath
    )

    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $pathFull = [IO.Path]::GetFullPath($FullPath)
    if (-not (Test-PathInsideRoot -Root $rootFull -Candidate $pathFull)) {
        throw "Path is outside the plugin root: $pathFull"
    }

    return Normalize-RelativePath -Path $pathFull.Substring($rootFull.Length)
}

function Read-TextFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [IO.File]::ReadAllText($Path)
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $json = $Value | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-AssetMap {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot
    )

    $adminPath = Join-Path $PluginRoot 'MyCompanyAdmin.js'
    $source = Read-TextFile -Path $adminPath
    $map = @{}

    $pattern = '(?ms)"(?<asset>[^"]+)"\s*:\s*\[\s*"(?<path>[^"]+)"\s*,'
    foreach ($match in [regex]::Matches($source, $pattern)) {
        $asset = Normalize-RelativePath -Path $match.Groups['asset'].Value
        $path = Normalize-RelativePath -Path $match.Groups['path'].Value
        $map[$asset.ToLowerInvariant()] = $path
    }

    return $map
}

function Get-AssetTokens {
    param([Parameter(Mandatory = $true)][string]$Text)

    $values = New-Object System.Collections.Generic.List[string]
    $quotedPattern = '(?i)["''](?<value>[^"'']+\.(?:js|css|html?|json|svg|png|jpe?g|webp))(?:\?[^"'']*)?["'']'
    $urlPattern = '(?i)url\(\s*["'']?(?<value>[^\)"'']+\.(?:svg|png|jpe?g|webp))(?:\?[^\)"'']*)?["'']?\s*\)'

    foreach ($match in [regex]::Matches($Text, $quotedPattern)) {
        [void]$values.Add($match.Groups['value'].Value)
    }
    foreach ($match in [regex]::Matches($Text, $urlPattern)) {
        [void]$values.Add($match.Groups['value'].Value)
    }

    return @($values | Sort-Object -Unique)
}

function Resolve-AssetToken {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap,
        [Parameter(Mandatory = $true)][string]$Token
    )

    $value = $Token.Replace('\', '/').Trim()
    $value = $value -replace '^__ASSET_BASE__/', ''
    $value = ($value -split '[?#]', 2)[0]
    $value = Normalize-RelativePath -Path $value

    if (-not $value -or $value.Contains('..')) {
        return $null
    }

    $key = $value.ToLowerInvariant()
    if ($AssetMap.ContainsKey($key)) {
        $mapped = Normalize-RelativePath -Path $AssetMap[$key]
        $mappedFull = Get-FullPath -BasePath $PluginRoot -RelativePath $mapped
        if (Test-Path -LiteralPath $mappedFull -PathType Leaf) {
            return $mapped
        }
    }

    if ($value.StartsWith('public/', [System.StringComparison]::OrdinalIgnoreCase)) {
        $directFull = Get-FullPath -BasePath $PluginRoot -RelativePath $value
        if (Test-Path -LiteralPath $directFull -PathType Leaf) {
            return $value
        }
    }

    $publicCandidate = Normalize-RelativePath -Path ('public/' + $value)
    $publicFull = Get-FullPath -BasePath $PluginRoot -RelativePath $publicCandidate
    if (Test-Path -LiteralPath $publicFull -PathType Leaf) {
        return $publicCandidate
    }

    return $null
}

function Get-RecursiveAssetManifest {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap,
        [Parameter(Mandatory = $true)][string[]]$SeedPaths
    )

    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $seen = @{}

    foreach ($seed in $SeedPaths) {
        if (-not $seed) { continue }
        $normalized = Normalize-RelativePath -Path $seed
        if (-not $seen.ContainsKey($normalized.ToLowerInvariant())) {
            $queue.Enqueue($normalized)
        }
    }

    while ($queue.Count -gt 0) {
        $relative = Normalize-RelativePath -Path $queue.Dequeue()
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { continue }

        $full = Get-FullPath -BasePath $PluginRoot -RelativePath $relative
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
        if (-not (Test-PathInsideRoot -Root $PluginRoot -Candidate $full)) {
            throw "Resolved asset escaped the plugin root: $relative"
        }

        $seen[$key] = $relative
        $extension = [IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($extension -notin @('.js', '.css', '.html', '.htm')) { continue }

        $text = Read-TextFile -Path $full
        foreach ($token in Get-AssetTokens -Text $text) {
            $resolved = Resolve-AssetToken -PluginRoot $PluginRoot -AssetMap $AssetMap -Token $token
            if ($resolved -and -not $seen.ContainsKey($resolved.ToLowerInvariant())) {
                $queue.Enqueue($resolved)
            }
        }
    }

    return @($seen.Values | Sort-Object)
}

function Get-OldPortalManifest {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap
    )

    $entry = Join-Path $PluginRoot 'plugin-main.js'
    $source = Read-TextFile -Path $entry
    $start = $source.IndexOf('obj.onWebUIStartupEnd', [System.StringComparison]::Ordinal)
    $end = if ($start -ge 0) {
        $source.IndexOf('obj.goPageStart', $start, [System.StringComparison]::Ordinal)
    } else {
        -1
    }

    if ($start -lt 0 -or $end -le $start) {
        throw 'Unable to locate the native GUI browser bootstrap in plugin-main.js.'
    }

    $browserBootstrap = $source.Substring($start, $end - $start)
    $seeds = New-Object System.Collections.Generic.List[string]
    foreach ($token in Get-AssetTokens -Text $browserBootstrap) {
        $resolved = Resolve-AssetToken -PluginRoot $PluginRoot -AssetMap $AssetMap -Token $token
        if ($resolved) { [void]$seeds.Add($resolved) }
    }

    return Get-RecursiveAssetManifest -PluginRoot $PluginRoot -AssetMap $AssetMap -SeedPaths @($seeds)
}

function Get-NewPortalManifest {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap
    )

    $seeds = @(
        'public/portal-standalone.html',
        'public/portal-login.html'
    )

    return Get-RecursiveAssetManifest -PluginRoot $PluginRoot -AssetMap $AssetMap -SeedPaths $seeds
}

function Get-TextFiles {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [string[]]$ExcludeRoots = @()
    )

    $allowedExtensions = @('.js', '.css', '.html', '.htm', '.handlebars', '.json', '.md', '.ps1', '.txt')
    $rootFull = [IO.Path]::GetFullPath($PluginRoot)
    $excluded = @($ExcludeRoots | Where-Object { $_ } | ForEach-Object {
        [IO.Path]::GetFullPath($_).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    })

    return @(Get-ChildItem -LiteralPath $rootFull -Recurse -File -ErrorAction Stop | Where-Object {
        $file = $_
        if ($allowedExtensions -notcontains $file.Extension.ToLowerInvariant()) { return $false }
        if ($file.FullName -match '[\\/](?:\.git|node_modules)[\\/]') { return $false }
        foreach ($excludedRoot in $excluded) {
            if ($file.FullName.StartsWith($excludedRoot + [IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
                $file.FullName.Equals($excludedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $false
            }
        }
        return $true
    })
}

function Find-AssetReferences {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][System.IO.FileInfo[]]$Files,
        [Parameter(Mandatory = $true)][string[]]$Assets,
        [string]$ExcludeRelativePath
    )

    $results = New-Object System.Collections.Generic.List[object]
    $needles = @{}

    foreach ($asset in $Assets) {
        $relative = Normalize-RelativePath -Path $asset
        $needles[$relative.ToLowerInvariant()] = @(
            $relative,
            [IO.Path]::GetFileName($relative)
        ) | Sort-Object -Unique
    }

    foreach ($file in $Files) {
        $relativeFile = Get-RelativeFromRoot -Root $PluginRoot -FullPath $file.FullName
        if ($ExcludeRelativePath -and $relativeFile.Equals($ExcludeRelativePath, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($assetKey in $needles.Keys) {
                foreach ($needle in $needles[$assetKey]) {
                    if ($line.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        [void]$results.Add([pscustomobject]@{
                            Asset      = $needles[$assetKey][0]
                            File       = $relativeFile
                            LineNumber = $lineNumber
                            Line       = $line.Trim()
                        })
                        break
                    }
                }
            }
        }
    }

    return @($results)
}

function Find-LegacyClassReferences {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][System.IO.FileInfo[]]$Files,
        [string]$ExcludeRelativePath
    )

    $patterns = @(
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Legacy native selection classes'; Regex = '\b(?:style1|fullselect|semiselect|lbbuttonsel2?|lbtg)\b' },
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Legacy native menu identifiers'; Regex = '\b(?:MainMenuMyCompany|LeftMenuMyCompany|MainMenuMyDevices|LeftMenuMyDevices)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Legacy Management layout classes'; Regex = '\bsirk-management-(?:shell|workspace|column|toolbar|item|list|tool|details|tree)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'SharedPage compatibility classes'; Regex = '\bmc-shared-(?:page|layout|primary|secondary|details|nav-item|toolbar|card)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Approval compatibility classes'; Regex = '\bmc-approval-(?:nav-item|nav-icon|nav-label|provider|status)\b' },
        [pscustomobject]@{ Category = 'BootstrapCompatibility'; Name = 'Legacy Bootstrap button classes'; Regex = '\bbtn-(?:primary|secondary|success|danger|warning|info|light|dark|sm|lg)\b' }
    )

    $results = New-Object System.Collections.Generic.List[object]
    foreach ($file in $Files) {
        $relativeFile = Get-RelativeFromRoot -Root $PluginRoot -FullPath $file.FullName
        if ($ExcludeRelativePath -and $relativeFile.Equals($ExcludeRelativePath, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($pattern in $patterns) {
                if ([regex]::IsMatch($line, $pattern.Regex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                    [void]$results.Add([pscustomobject]@{
                        Category   = $pattern.Category
                        Pattern    = $pattern.Name
                        File       = $relativeFile
                        LineNumber = $lineNumber
                        Line       = $line.Trim()
                    })
                }
            }
        }
    }

    return @($results)
}

function Export-ReportCsv {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Rows
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    @($Rows) | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
}

function New-Backup {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][string]$TargetBackupRoot,
        [Parameter(Mandatory = $true)][string]$SelectedPortal,
        [Parameter(Mandatory = $true)][string]$SelectedScope,
        [Parameter(Mandatory = $true)][string[]]$Files
    )

    if (-not (Test-Path -LiteralPath $TargetBackupRoot)) {
        New-Item -ItemType Directory -Path $TargetBackupRoot -Force | Out-Null
    }

    $id = '{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $SelectedPortal, $SelectedScope
    $directory = Join-Path $TargetBackupRoot $id
    $filesRoot = Join-Path $directory 'files'
    New-Item -ItemType Directory -Path $filesRoot -Force | Out-Null

    $entries = New-Object System.Collections.Generic.List[object]
    foreach ($relative in $Files) {
        $source = Get-FullPath -BasePath $PluginRoot -RelativePath $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }

        $destination = Get-FullPath -BasePath $filesRoot -RelativePath $relative
        $destinationParent = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $destinationParent)) {
            New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        }

        Copy-Item -LiteralPath $source -Destination $destination -Force
        [void]$entries.Add([pscustomobject]@{
            RelativePath = Normalize-RelativePath -Path $relative
            Sha256       = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
            Length       = (Get-Item -LiteralPath $source).Length
        })
    }

    $manifest = [pscustomobject]@{
        SchemaVersion = 1
        CreatedAt     = (Get-Date).ToString('o')
        PluginRoot    = $PluginRoot
        Portal        = $SelectedPortal
        Scope         = $SelectedScope
        Files         = @($entries)
    }

    Write-JsonFile -Path (Join-Path $directory 'manifest.json') -Value $manifest

    $zipPath = $directory + '.zip'
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $directory '*') -DestinationPath $zipPath -CompressionLevel Optimal

    return [pscustomobject]@{
        Directory = $directory
        Zip       = $zipPath
        Manifest  = $manifest
    }
}

function Resolve-BackupDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolved = [IO.Path]::GetFullPath($Path)
    if (Test-Path -LiteralPath $resolved -PathType Container) {
        return [pscustomobject]@{ Directory = $resolved; Temporary = $false }
    }

    if (Test-Path -LiteralPath $resolved -PathType Leaf) {
        if ([IO.Path]::GetExtension($resolved) -ne '.zip') {
            throw 'BackupPath must point to a backup directory or ZIP archive.'
        }

        $temporary = Join-Path ([IO.Path]::GetTempPath()) ('MyCompany-PortalGuiRestore-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $temporary -Force | Out-Null
        Expand-Archive -LiteralPath $resolved -DestinationPath $temporary -Force
        return [pscustomobject]@{ Directory = $temporary; Temporary = $true }
    }

    throw "Backup does not exist: $resolved"
}

function Restore-Backup {
    param(
        [Parameter(Mandatory = $true)][string]$PluginRoot,
        [Parameter(Mandatory = $true)][string]$SelectedPortal,
        [Parameter(Mandatory = $true)][string]$SourceBackupPath
    )

    $resolvedBackup = Resolve-BackupDirectory -Path $SourceBackupPath
    try {
        $manifestPath = Join-Path $resolvedBackup.Directory 'manifest.json'
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
            $manifestItem = Get-ChildItem -LiteralPath $resolvedBackup.Directory -Filter manifest.json -Recurse -File | Select-Object -First 1
            if (-not $manifestItem) { throw 'Backup manifest.json was not found.' }
            $manifestPath = $manifestItem.FullName
        }

        $backupDirectory = Split-Path -Parent $manifestPath
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ([string]$manifest.Portal -ne $SelectedPortal) {
            throw "Backup Portal '$($manifest.Portal)' does not match requested Portal '$SelectedPortal'."
        }

        $filesRoot = Join-Path $backupDirectory 'files'
        if (-not (Test-Path -LiteralPath $filesRoot -PathType Container)) {
            throw 'Backup files directory is missing.'
        }

        $restored = New-Object System.Collections.Generic.List[string]
        foreach ($entry in @($manifest.Files)) {
            $relative = Normalize-RelativePath -Path ([string]$entry.RelativePath)
            $source = Get-FullPath -BasePath $filesRoot -RelativePath $relative
            $destination = Get-FullPath -BasePath $PluginRoot -RelativePath $relative
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
                throw "Backup file is missing: $relative"
            }

            $parent = Split-Path -Parent $destination
            if (-not (Test-Path -LiteralPath $parent)) {
                New-Item -ItemType Directory -Path $parent -Force | Out-Null
            }

            Copy-Item -LiteralPath $source -Destination $destination -Force
            $actualHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
            if ($actualHash -ne [string]$entry.Sha256) {
                throw "Restored file hash mismatch: $relative"
            }
            [void]$restored.Add($relative)
        }

        return @($restored)
    }
    finally {
        if ($resolvedBackup.Temporary -and (Test-Path -LiteralPath $resolvedBackup.Directory)) {
            Remove-Item -LiteralPath $resolvedBackup.Directory -Recurse -Force
        }
    }
}

function Write-Result {
    param(
        [Parameter(Mandatory = $true)]$Result,
        [Parameter(Mandatory = $true)][int]$Code
    )

    $Result.ExitCode = $Code
    if ($OutputFormat -eq 'Json') {
        $Result | ConvertTo-Json -Depth 12 -Compress
    } else {
        $Result
    }

    exit $Code
}

try {
    $pluginRoot = [IO.Path]::GetFullPath($RootPath)
    $required = @(
        'plugin-main.js',
        'MyCompanyAdmin.js',
        'public/portal-standalone.html',
        'public/portal-login.html'
    )

    if (-not (Test-Path -LiteralPath $pluginRoot -PathType Container)) {
        throw "Plugin root does not exist: $pluginRoot"
    }
    foreach ($relative in $required) {
        $requiredPath = Get-FullPath -BasePath $pluginRoot -RelativePath $relative
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Required MyCompany file does not exist: $relative"
        }
    }

    if (-not $BackupRoot) {
        $BackupRoot = Join-Path (Split-Path -Parent $pluginRoot) 'MyCompany-PortalGuiBackups'
    }
    $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)

    if (-not $ReportPath) {
        $reportId = '{0}-{1}-{2}-{3}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Portal, $Scope, $Action
        $ReportPath = Join-Path (Join-Path ([IO.Path]::GetTempPath()) 'MyCompany-PortalGuiAudit') $reportId
    }
    $ReportPath = [IO.Path]::GetFullPath($ReportPath)
    if (-not (Test-Path -LiteralPath $ReportPath)) {
        New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null
    }

    $assetMap = Get-AssetMap -PluginRoot $pluginRoot
    $oldManifest = @(Get-OldPortalManifest -PluginRoot $pluginRoot -AssetMap $assetMap)
    $newManifest = @(Get-NewPortalManifest -PluginRoot $pluginRoot -AssetMap $assetMap)
    $commonManifest = @($oldManifest | Where-Object { $newManifest -contains $_ } | Sort-Object -Unique)

    $targetManifest = if ($Portal -eq 'Old') { $oldManifest } else { $newManifest }
    $otherManifest = if ($Portal -eq 'Old') { $newManifest } else { $oldManifest }
    $selected = if ($Scope -eq 'Exclusive') {
        @($targetManifest | Where-Object { $otherManifest -notcontains $_ } | Sort-Object -Unique)
    } else {
        @($targetManifest | Sort-Object -Unique)
    }

    $selected = @($selected | Where-Object {
        $value = Normalize-RelativePath -Path $_
        $full = Get-FullPath -BasePath $pluginRoot -RelativePath $value
        $value.StartsWith('public/', [System.StringComparison]::OrdinalIgnoreCase) -and
            (Test-PathInsideRoot -Root $pluginRoot -Candidate $full)
    })

    $existingSelected = @($selected | Where-Object {
        Test-Path -LiteralPath (Get-FullPath -BasePath $pluginRoot -RelativePath $_) -PathType Leaf
    })
    $missingSelected = @($selected | Where-Object {
        -not (Test-Path -LiteralPath (Get-FullPath -BasePath $pluginRoot -RelativePath $_) -PathType Leaf)
    })

    $scriptRelative = $null
    try {
        if ($PSCommandPath -and (Test-PathInsideRoot -Root $pluginRoot -Candidate $PSCommandPath)) {
            $scriptRelative = Get-RelativeFromRoot -Root $pluginRoot -FullPath $PSCommandPath
        }
    } catch {
        Write-Verbose "Unable to resolve script relative path: $($_.Exception.Message)"
    }

    $searchFiles = @(Get-TextFiles -PluginRoot $pluginRoot -ExcludeRoots @($BackupRoot, $ReportPath))
    $assetReferencesBefore = @(Find-AssetReferences -PluginRoot $pluginRoot -Files $searchFiles -Assets $selected -ExcludeRelativePath $scriptRelative)
    $legacyReferences = @(Find-LegacyClassReferences -PluginRoot $pluginRoot -Files $searchFiles -ExcludeRelativePath $scriptRelative)

    Write-JsonFile -Path (Join-Path $ReportPath 'old-manifest.json') -Value $oldManifest
    Write-JsonFile -Path (Join-Path $ReportPath 'new-manifest.json') -Value $newManifest
    Write-JsonFile -Path (Join-Path $ReportPath 'common-manifest.json') -Value $commonManifest
    Write-JsonFile -Path (Join-Path $ReportPath 'selected-manifest.json') -Value $selected
    Export-ReportCsv -Path (Join-Path $ReportPath 'asset-references-before.csv') -Rows $assetReferencesBefore
    Export-ReportCsv -Path (Join-Path $ReportPath 'legacy-class-usage.csv') -Rows $legacyReferences

    $changed = $false
    $skipped = $false
    $skipReason = $null
    $backup = $null
    $restoredFiles = @()
    $removedFiles = @()
    $verificationFailures = @()

    if ($Force) {
        $ConfirmPreference = 'None'
    }

    if ($Action -eq 'Remove') {
        $description = "Create backup and remove $($existingSelected.Count) $Portal GUI file(s), scope $Scope"
        if (-not $PSCmdlet.ShouldProcess($pluginRoot, $description)) {
            $skipped = $true
            $skipReason = 'Remove was not approved or was executed with -WhatIf.'
            $script:ExitCode = 10
        } elseif ($existingSelected.Count -gt 0) {
            $backup = New-Backup -PluginRoot $pluginRoot -TargetBackupRoot $BackupRoot -SelectedPortal $Portal -SelectedScope $Scope -Files $existingSelected
            foreach ($relative in $existingSelected) {
                $full = Get-FullPath -BasePath $pluginRoot -RelativePath $relative
                Remove-Item -LiteralPath $full -Force
                [void]$removedFiles.Add($relative)
            }

            foreach ($relative in $removedFiles) {
                $full = Get-FullPath -BasePath $pluginRoot -RelativePath $relative
                if (Test-Path -LiteralPath $full) {
                    $verificationFailures += $relative
                }
            }

            if ($verificationFailures.Count -gt 0) {
                $script:ExitCode = 5
            } else {
                $changed = $removedFiles.Count -gt 0
            }
        }
    } elseif ($Action -eq 'Restore') {
        if (-not $BackupPath) {
            throw 'BackupPath is required for Action Restore.'
        }

        $description = "Restore $Portal GUI files from backup '$BackupPath'"
        if (-not $PSCmdlet.ShouldProcess($pluginRoot, $description)) {
            $skipped = $true
            $skipReason = 'Restore was not approved or was executed with -WhatIf.'
            $script:ExitCode = 10
        } else {
            $restoredFiles = @(Restore-Backup -PluginRoot $pluginRoot -SelectedPortal $Portal -SourceBackupPath $BackupPath)
            $changed = $restoredFiles.Count -gt 0
        }
    }

    $searchFilesAfter = @(Get-TextFiles -PluginRoot $pluginRoot -ExcludeRoots @($BackupRoot, $ReportPath))
    $assetReferencesAfter = @(Find-AssetReferences -PluginRoot $pluginRoot -Files $searchFilesAfter -Assets $selected -ExcludeRelativePath $scriptRelative)
    Export-ReportCsv -Path (Join-Path $ReportPath 'asset-references-after.csv') -Rows $assetReferencesAfter

    $summary = [pscustomobject]@{
        Success                    = $script:ExitCode -eq 0
        Changed                    = $changed
        Skipped                    = $skipped
        SkipReason                 = $skipReason
        Operation                  = "PortalGui$Action"
        Portal                     = $Portal
        Scope                      = $Scope
        PluginRoot                 = $pluginRoot
        OldManifestCount           = $oldManifest.Count
        NewManifestCount           = $newManifest.Count
        CommonManifestCount        = $commonManifest.Count
        SelectedManifestCount      = $selected.Count
        ExistingSelectedCount      = $existingSelected.Count
        MissingSelectedCount       = $missingSelected.Count
        RemovedCount               = $removedFiles.Count
        RestoredCount              = $restoredFiles.Count
        LegacyClassReferenceCount  = $legacyReferences.Count
        AssetReferenceBeforeCount  = $assetReferencesBefore.Count
        AssetReferenceAfterCount   = $assetReferencesAfter.Count
        VerificationFailures       = @($verificationFailures)
        RemovedFiles               = @($removedFiles)
        RestoredFiles              = @($restoredFiles)
        BackupDirectory            = if ($backup) { $backup.Directory } else { $null }
        BackupZip                  = if ($backup) { $backup.Zip } else { $null }
        ReportPath                 = $ReportPath
        Message                    = if ($Action -eq 'Audit') {
            'Audit completed. No plugin files were changed.'
        } elseif ($skipped) {
            $skipReason
        } elseif ($script:ExitCode -eq 0) {
            "$Action completed and verified."
        } else {
            "$Action completed with verification failures."
        }
        ExitCode                   = $script:ExitCode
    }

    Write-JsonFile -Path (Join-Path $ReportPath 'summary.json') -Value $summary
    Write-Result -Result $summary -Code $script:ExitCode
}
catch {
    $message = $_.Exception.Message
    $failure = [pscustomobject]@{
        Success    = $false
        Changed    = $false
        Skipped    = $false
        SkipReason = $null
        Operation  = "PortalGui$Action"
        Portal     = $Portal
        Scope      = $Scope
        PluginRoot = $RootPath
        ReportPath = $ReportPath
        Message    = $message
        ExitCode   = 1
    }

    if ($OutputFormat -eq 'Json') {
        $failure | ConvertTo-Json -Depth 8 -Compress
    } else {
        $failure
    }
    Write-Error $message
    exit 1
}
