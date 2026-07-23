<#
.SYNOPSIS
Audits, removes or restores the old native GUI or the new standalone SirK Portal assets.

.DESCRIPTION
The script discovers file lists from the real loading chains:

- Old: browser assets loaded by plugin-main.js.
- New: assets loaded by public/portal-standalone.html and public/portal-login.html.

Exclusive selects only files not used by the other GUI.
Full selects the complete graph, including shared files.

Remove creates a directory backup, ZIP archive, SHA256 manifest and dependency reports.
The script never stops or restarts MeshCentral.

.EXAMPLE
./tools/Invoke-PortalGuiIsolation.ps1 -Portal Old -Action Audit

.EXAMPLE
./tools/Invoke-PortalGuiIsolation.ps1 -Portal Old -Action Remove -Scope Exclusive -RootPath 'C:/Program Files/Open Source/MeshCentral/meshcentral-data/plugins/MyCompany' -Force

.EXAMPLE
./tools/Invoke-PortalGuiIsolation.ps1 -Portal New -Action Remove -Scope Full -RootPath 'C:/Program Files/Open Source/MeshCentral/meshcentral-data/plugins/MyCompany' -WhatIf

.EXAMPLE
./tools/Invoke-PortalGuiIsolation.ps1 -Portal New -Action Restore -BackupPath 'D:/MyCompany-PortalGuiBackups/20260723-190000-New-Full' -Force
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

function ConvertTo-NormalizedRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $value = $Path.Replace([char]92, '/').Trim()
    while ($value.StartsWith('./', [System.StringComparison]::Ordinal)) {
        $value = $value.Substring(2)
    }
    return $value.TrimStart([char[]]@('/', [char]92))
}

function Get-PluginFilePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $normalized = ConvertTo-NormalizedRelativePath -Path $RelativePath
    $nativePath = $normalized.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    return [System.IO.Path]::GetFullPath((Join-Path -Path $Root -ChildPath $nativePath))
}

function Test-PathUnderRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Candidate
    )

    $trimChars = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd($trimChars)
    $candidateFull = [System.IO.Path]::GetFullPath($Candidate)

    if ($candidateFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    return $candidateFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-RelativePathFromRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$FullPath
    )

    $trimChars = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd($trimChars)
    $pathFull = [System.IO.Path]::GetFullPath($FullPath)

    if (-not (Test-PathUnderRoot -Root $rootFull -Candidate $pathFull)) {
        throw "Path is outside plugin root: $pathFull"
    }

    $relative = $pathFull.Substring($rootFull.Length)
    return ConvertTo-NormalizedRelativePath -Path $relative
}

function Read-Utf8Text {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.File]::ReadAllText($Path)
}

function Write-JsonReport {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyCollection()]$Value
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    $json = ConvertTo-Json -InputObject $Value -Depth 14
    [System.IO.File]::WriteAllText($Path, $json, $encoding)
}

function Export-CsvReport {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Rows
    )

    $rowsArray = @($Rows)
    if ($rowsArray.Count -eq 0) {
        $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
        [System.IO.File]::WriteAllText($Path, '', $encoding)
        return
    }

    $rowsArray | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
}

function Get-AdminAssetMap {
    param([Parameter(Mandatory = $true)][string]$Root)

    $adminPath = Join-Path -Path $Root -ChildPath 'MyCompanyAdmin.js'
    $source = Read-Utf8Text -Path $adminPath
    $map = @{}
    $pattern = '(?ms)"(?<asset>[^"]+)"\s*:\s*\[\s*"(?<path>[^"]+)"\s*,'

    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($source, $pattern)) {
        $asset = ConvertTo-NormalizedRelativePath -Path $match.Groups['asset'].Value
        $mappedPath = ConvertTo-NormalizedRelativePath -Path $match.Groups['path'].Value
        $map[$asset.ToLowerInvariant()] = $mappedPath
    }

    return $map
}

function Get-ReferencedAssetTokens {
    param([Parameter(Mandatory = $true)][string]$Text)

    $tokens = New-Object -TypeName 'System.Collections.Generic.List[string]'
    $quotedPattern = '(?i)["''](?<value>[^"'']+\.(?:js|css|html?|json|svg|png|jpe?g|webp))(?:\?[^"'']*)?["'']'
    $cssUrlPattern = '(?i)url\(\s*["'']?(?<value>[^\)"'']+\.(?:svg|png|jpe?g|webp))(?:\?[^\)"'']*)?["'']?\s*\)'

    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($Text, $quotedPattern)) {
        [void]$tokens.Add($match.Groups['value'].Value)
    }
    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($Text, $cssUrlPattern)) {
        [void]$tokens.Add($match.Groups['value'].Value)
    }

    return @($tokens | Sort-Object -Unique)
}

function Resolve-AssetPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap,
        [Parameter(Mandatory = $true)][string]$Token
    )

    $value = $Token.Replace([char]92, '/').Trim()
    $value = $value -replace '^__ASSET_BASE__/', ''
    $value = ($value -split '[?#]', 2)[0]
    $value = ConvertTo-NormalizedRelativePath -Path $value

    if (-not $value -or $value.Contains('..')) {
        return $null
    }

    $key = $value.ToLowerInvariant()
    if ($AssetMap.ContainsKey($key)) {
        $mapped = ConvertTo-NormalizedRelativePath -Path $AssetMap[$key]
        $mappedFull = Get-PluginFilePath -Root $Root -RelativePath $mapped
        if (Test-Path -LiteralPath $mappedFull -PathType Leaf) {
            return $mapped
        }
    }

    $candidate = if ($value.StartsWith('public/', [System.StringComparison]::OrdinalIgnoreCase)) {
        $value
    } else {
        'public/' + $value
    }

    $candidateFull = Get-PluginFilePath -Root $Root -RelativePath $candidate
    if ((Test-PathUnderRoot -Root $Root -Candidate $candidateFull) -and
        (Test-Path -LiteralPath $candidateFull -PathType Leaf)) {
        return ConvertTo-NormalizedRelativePath -Path $candidate
    }

    return $null
}

function Expand-AssetGraph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap,
        [Parameter(Mandatory = $true)][string[]]$SeedPaths
    )

    $queue = New-Object -TypeName 'System.Collections.Generic.Queue[string]'
    $seen = @{}

    foreach ($seed in $SeedPaths) {
        if ($seed) {
            $queue.Enqueue((ConvertTo-NormalizedRelativePath -Path $seed))
        }
    }

    while ($queue.Count -gt 0) {
        $relative = ConvertTo-NormalizedRelativePath -Path $queue.Dequeue()
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) {
            continue
        }

        $fullPath = Get-PluginFilePath -Root $Root -RelativePath $relative
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            continue
        }
        if (-not (Test-PathUnderRoot -Root $Root -Candidate $fullPath)) {
            throw "Resolved asset escaped plugin root: $relative"
        }

        $seen[$key] = $relative
        $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
        if ($extension -notin @('.js', '.css', '.html', '.htm')) {
            continue
        }

        $text = Read-Utf8Text -Path $fullPath
        $tokens = @(Get-ReferencedAssetTokens -Text $text)
        foreach ($token in $tokens) {
            $resolved = Resolve-AssetPath -Root $Root -AssetMap $AssetMap -Token $token
            if ($resolved -and -not $seen.ContainsKey($resolved.ToLowerInvariant())) {
                $queue.Enqueue($resolved)
            }
        }
    }

    return @($seen.Values | Sort-Object)
}

function Get-OldPortalGraph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap
    )

    $entryPath = Join-Path -Path $Root -ChildPath 'plugin-main.js'
    $source = Read-Utf8Text -Path $entryPath
    $start = $source.IndexOf('obj.onWebUIStartupEnd', [System.StringComparison]::Ordinal)
    $end = if ($start -ge 0) {
        $source.IndexOf('obj.goPageStart', $start, [System.StringComparison]::Ordinal)
    } else {
        -1
    }

    if ($start -lt 0 -or $end -le $start) {
        throw 'Native browser bootstrap was not found in plugin-main.js.'
    }

    $bootstrap = $source.Substring($start, $end - $start)
    $seedList = New-Object -TypeName 'System.Collections.Generic.List[string]'
    $tokens = @(Get-ReferencedAssetTokens -Text $bootstrap)
    foreach ($token in $tokens) {
        $resolved = Resolve-AssetPath -Root $Root -AssetMap $AssetMap -Token $token
        if ($resolved) {
            [void]$seedList.Add($resolved)
        }
    }

    return Expand-AssetGraph -Root $Root -AssetMap $AssetMap -SeedPaths @($seedList)
}

function Get-NewPortalGraph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$AssetMap
    )

    return Expand-AssetGraph -Root $Root -AssetMap $AssetMap -SeedPaths @(
        'public/portal-standalone.html',
        'public/portal-login.html'
    )
}

function ConvertTo-PathSet {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Paths)

    $set = @{}
    foreach ($path in $Paths) {
        $normalized = ConvertTo-NormalizedRelativePath -Path $path
        $set[$normalized.ToLowerInvariant()] = $normalized
    }
    return $set
}

function Get-ScannableFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [string[]]$ExcludedRoots = @()
    )

    $extensions = @('.js', '.css', '.html', '.htm', '.handlebars', '.json', '.md', '.ps1', '.txt')
    $excluded = @($ExcludedRoots | Where-Object { $_ } | ForEach-Object {
        [System.IO.Path]::GetFullPath($_)
    })

    $files = Get-ChildItem -LiteralPath $Root -Recurse -File
    return @($files | Where-Object {
        $item = $_
        $include = $extensions -contains $item.Extension.ToLowerInvariant()
        if ($include -and $item.FullName -match '[\\/](?:\.git|node_modules)[\\/]') {
            $include = $false
        }
        if ($include) {
            foreach ($excludedRoot in $excluded) {
                if ($item.FullName.StartsWith($excludedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                    $include = $false
                    break
                }
            }
        }
        $include
    })
}

function Find-AssetReferences {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][System.IO.FileInfo[]]$Files,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Assets,
        [string]$ExcludedFile
    )

    $rows = New-Object -TypeName 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelativePathFromRoot -Root $Root -FullPath $file.FullName
        if ($ExcludedFile -and $relativeFile.Equals($ExcludedFile, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        $lineNumber = 0
        foreach ($line in [System.IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($asset in $Assets) {
                $normalized = ConvertTo-NormalizedRelativePath -Path $asset
                $fileName = [System.IO.Path]::GetFileName($normalized)
                if ($line.IndexOf($normalized, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
                    $line.IndexOf($fileName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    [void]$rows.Add([pscustomobject]@{
                        Asset = $normalized
                        File = $relativeFile
                        LineNumber = $lineNumber
                        Line = $line.Trim()
                    })
                }
            }
        }
    }

    return @($rows)
}

function Find-LegacyClassReferences {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][System.IO.FileInfo[]]$Files,
        [string]$ExcludedFile
    )

    $patterns = @(
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Native selection classes'; Regex = '\b(?:style1|fullselect|semiselect|lbbuttonsel2?|lbtg)\b' },
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Native menu identifiers'; Regex = '\b(?:MainMenuMyCompany|LeftMenuMyCompany|MainMenuMyDevices|LeftMenuMyDevices)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Management compatibility classes'; Regex = '\bsirk-management-(?:shell|workspace|column|toolbar|item|list|tool|details|tree)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'SharedPage compatibility classes'; Regex = '\bmc-shared-(?:page|layout|primary|secondary|details|nav-item|toolbar|card)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Approval compatibility classes'; Regex = '\bmc-approval-(?:nav-item|nav-icon|nav-label|provider|status)\b' },
        [pscustomobject]@{ Category = 'BootstrapCompatibility'; Name = 'Bootstrap button classes'; Regex = '\bbtn-(?:primary|secondary|success|danger|warning|info|light|dark|sm|lg)\b' }
    )

    $rows = New-Object -TypeName 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelativePathFromRoot -Root $Root -FullPath $file.FullName
        if ($ExcludedFile -and $relativeFile.Equals($ExcludedFile, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        $lineNumber = 0
        foreach ($line in [System.IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($pattern in $patterns) {
                $matched = [System.Text.RegularExpressions.Regex]::IsMatch(
                    $line,
                    $pattern.Regex,
                    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
                )
                if ($matched) {
                    [void]$rows.Add([pscustomobject]@{
                        Category = $pattern.Category
                        Pattern = $pattern.Name
                        File = $relativeFile
                        LineNumber = $lineNumber
                        Line = $line.Trim()
                    })
                }
            }
        }
    }

    return @($rows)
}

function New-PortalGuiBackup {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$DestinationRoot,
        [Parameter(Mandatory = $true)][string]$PortalName,
        [Parameter(Mandatory = $true)][string]$ScopeName,
        [Parameter(Mandatory = $true)][string[]]$Files
    )

    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    $backupId = '{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PortalName, $ScopeName
    $backupDirectory = Join-Path -Path $DestinationRoot -ChildPath $backupId
    $backupFilesRoot = Join-Path -Path $backupDirectory -ChildPath 'files'
    New-Item -ItemType Directory -Path $backupFilesRoot -Force | Out-Null

    $entries = New-Object -TypeName 'System.Collections.Generic.List[object]'
    foreach ($relative in $Files) {
        $source = Get-PluginFilePath -Root $Root -RelativePath $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            continue
        }

        $destination = Get-PluginFilePath -Root $backupFilesRoot -RelativePath $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force

        [void]$entries.Add([pscustomobject]@{
            RelativePath = ConvertTo-NormalizedRelativePath -Path $relative
            Sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
            Length = (Get-Item -LiteralPath $source).Length
        })
    }

    $manifest = [pscustomobject]@{
        SchemaVersion = 1
        CreatedAt = (Get-Date).ToString('o')
        PluginRoot = $Root
        Portal = $PortalName
        Scope = $ScopeName
        Files = @($entries)
    }
    Write-JsonReport -Path (Join-Path $backupDirectory 'manifest.json') -Value $manifest

    $zipPath = $backupDirectory + '.zip'
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $backupDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal

    return [pscustomobject]@{
        Directory = $backupDirectory
        Zip = $zipPath
        Manifest = $manifest
    }
}

function Open-PortalGuiBackup {
    param([Parameter(Mandatory = $true)][string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (Test-Path -LiteralPath $fullPath -PathType Container) {
        return [pscustomobject]@{ Directory = $fullPath; Temporary = $false }
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf) -or
        [System.IO.Path]::GetExtension($fullPath) -ne '.zip') {
        throw 'BackupPath must point to an existing backup directory or ZIP archive.'
    }

    $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ('MyCompany-PortalRestore-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary -Force | Out-Null
    Expand-Archive -LiteralPath $fullPath -DestinationPath $temporary -Force
    return [pscustomobject]@{ Directory = $temporary; Temporary = $true }
}

function Restore-PortalGuiBackup {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$PortalName,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $opened = Open-PortalGuiBackup -Path $Path
    try {
        $manifestFile = Get-ChildItem -LiteralPath $opened.Directory -Filter manifest.json -Recurse -File | Select-Object -First 1
        if (-not $manifestFile) {
            throw 'manifest.json was not found in the backup.'
        }

        $backupDirectory = Split-Path -Parent $manifestFile.FullName
        $backupFilesRoot = Join-Path -Path $backupDirectory -ChildPath 'files'
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        if ([string]$manifest.Portal -ne $PortalName) {
            throw "Backup Portal '$($manifest.Portal)' does not match requested Portal '$PortalName'."
        }

        $restored = New-Object -TypeName 'System.Collections.Generic.List[string]'
        foreach ($entry in @($manifest.Files)) {
            $relative = ConvertTo-NormalizedRelativePath -Path ([string]$entry.RelativePath)
            $source = Get-PluginFilePath -Root $backupFilesRoot -RelativePath $relative
            $destination = Get-PluginFilePath -Root $Root -RelativePath $relative

            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
                throw "Backup file is missing: $relative"
            }

            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
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
        if ($opened.Temporary -and (Test-Path -LiteralPath $opened.Directory)) {
            Remove-Item -LiteralPath $opened.Directory -Recurse -Force
        }
    }
}

function Complete-PortalGuiOperation {
    param(
        [Parameter(Mandatory = $true)]$Result,
        [Parameter(Mandatory = $true)][int]$ExitCode
    )

    $Result.ExitCode = $ExitCode
    if ($OutputFormat -eq 'Json') {
        $Result | ConvertTo-Json -Depth 14 -Compress
    } else {
        $Result
    }
    exit $ExitCode
}

try {
    $root = [System.IO.Path]::GetFullPath($RootPath)
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        throw "Plugin root does not exist: $root"
    }

    foreach ($requiredFile in @('plugin-main.js', 'MyCompanyAdmin.js')) {
        $requiredPath = Get-PluginFilePath -Root $root -RelativePath $requiredFile
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Required MyCompany file is missing: $requiredFile"
        }
    }

    if (-not $BackupRoot) {
        $BackupRoot = Join-Path (Split-Path -Parent $root) 'MyCompany-PortalGuiBackups'
    }
    $BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

    if (-not $ReportPath) {
        $reportName = '{0}-{1}-{2}-{3}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Portal, $Scope, $Action
        $ReportPath = Join-Path (Join-Path ([System.IO.Path]::GetTempPath()) 'MyCompany-PortalGuiAudit') $reportName
    }
    $ReportPath = [System.IO.Path]::GetFullPath($ReportPath)
    New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null

    if ($Force) {
        $ConfirmPreference = 'None'
    }

    $changed = $false
    $skipped = $false
    $skipReason = $null
    $exitCode = 0
    $backup = $null
    $removed = New-Object -TypeName 'System.Collections.Generic.List[string]'
    $restored = @()
    $verificationFailures = @()

    if ($Action -eq 'Restore') {
        if (-not $BackupPath) {
            throw 'BackupPath is required for Restore.'
        }

        $restoreDescription = "Restore $Portal GUI files from '$BackupPath'"
        if (-not $PSCmdlet.ShouldProcess($root, $restoreDescription)) {
            $skipped = $true
            $skipReason = 'Restore was not approved or was run with -WhatIf.'
            $result = [pscustomobject]@{
                Success = $false
                Changed = $false
                Skipped = $true
                SkipReason = $skipReason
                Operation = 'PortalGuiRestore'
                Portal = $Portal
                Scope = $Scope
                PluginRoot = $root
                ReportPath = $ReportPath
                Message = $skipReason
                ExitCode = 10
            }
            Write-JsonReport -Path (Join-Path $ReportPath 'summary.json') -Value $result
            Complete-PortalGuiOperation -Result $result -ExitCode 10
        }

        $restored = @(Restore-PortalGuiBackup -Root $root -PortalName $Portal -Path $BackupPath)
        $changed = $restored.Count -gt 0
    }

    foreach ($portalDocument in @('public/portal-standalone.html', 'public/portal-login.html')) {
        $documentPath = Get-PluginFilePath -Root $root -RelativePath $portalDocument
        if (-not (Test-Path -LiteralPath $documentPath -PathType Leaf)) {
            throw "Required Portal document is missing: $portalDocument. Use Restore with the matching backup first."
        }
    }

    $assetMap = Get-AdminAssetMap -Root $root
    $oldGraph = @(Get-OldPortalGraph -Root $root -AssetMap $assetMap)
    $newGraph = @(Get-NewPortalGraph -Root $root -AssetMap $assetMap)
    $oldSet = ConvertTo-PathSet -Paths $oldGraph
    $newSet = ConvertTo-PathSet -Paths $newGraph

    $common = New-Object -TypeName 'System.Collections.Generic.List[string]'
    foreach ($key in $oldSet.Keys) {
        if ($newSet.ContainsKey($key)) {
            [void]$common.Add($oldSet[$key])
        }
    }

    $targetSet = if ($Portal -eq 'Old') { $oldSet } else { $newSet }
    $otherSet = if ($Portal -eq 'Old') { $newSet } else { $oldSet }
    $selected = New-Object -TypeName 'System.Collections.Generic.List[string]'

    foreach ($key in $targetSet.Keys) {
        if ($Scope -eq 'Full' -or -not $otherSet.ContainsKey($key)) {
            $relative = $targetSet[$key]
            if ($relative.StartsWith('public/', [System.StringComparison]::OrdinalIgnoreCase)) {
                [void]$selected.Add($relative)
            }
        }
    }

    $selectedFiles = @($selected | Sort-Object -Unique)
    $existingFiles = @($selectedFiles | Where-Object {
        $candidate = Get-PluginFilePath -Root $root -RelativePath $_
        Test-Path -LiteralPath $candidate -PathType Leaf
    })
    $missingFiles = @($selectedFiles | Where-Object {
        $candidate = Get-PluginFilePath -Root $root -RelativePath $_
        -not (Test-Path -LiteralPath $candidate -PathType Leaf)
    })

    $scriptRelativePath = $null
    if ($PSCommandPath -and (Test-PathUnderRoot -Root $root -Candidate $PSCommandPath)) {
        $scriptRelativePath = Get-RelativePathFromRoot -Root $root -FullPath $PSCommandPath
    }

    $textFiles = @(Get-ScannableFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $referencesBefore = @(Find-AssetReferences -Root $root -Files $textFiles -Assets $selectedFiles -ExcludedFile $scriptRelativePath)
    $legacyReferences = @(Find-LegacyClassReferences -Root $root -Files $textFiles -ExcludedFile $scriptRelativePath)

    Write-JsonReport -Path (Join-Path $ReportPath 'old-manifest.json') -Value $oldGraph
    Write-JsonReport -Path (Join-Path $ReportPath 'new-manifest.json') -Value $newGraph
    Write-JsonReport -Path (Join-Path $ReportPath 'common-manifest.json') -Value @($common | Sort-Object -Unique)
    Write-JsonReport -Path (Join-Path $ReportPath 'selected-manifest.json') -Value $selectedFiles
    Export-CsvReport -Path (Join-Path $ReportPath 'asset-references-before.csv') -Rows $referencesBefore
    Export-CsvReport -Path (Join-Path $ReportPath 'legacy-class-usage.csv') -Rows $legacyReferences

    if ($Action -eq 'Remove') {
        $removeDescription = "Backup and remove $($existingFiles.Count) $Portal GUI file(s), scope $Scope"
        if (-not $PSCmdlet.ShouldProcess($root, $removeDescription)) {
            $skipped = $true
            $skipReason = 'Remove was not approved or was run with -WhatIf.'
            $exitCode = 10
        } elseif ($existingFiles.Count -gt 0) {
            $backup = New-PortalGuiBackup -Root $root -DestinationRoot $BackupRoot -PortalName $Portal -ScopeName $Scope -Files $existingFiles

            foreach ($relative in $existingFiles) {
                $filePath = Get-PluginFilePath -Root $root -RelativePath $relative
                Remove-Item -LiteralPath $filePath -Force
                [void]$removed.Add($relative)
            }
            $changed = $removed.Count -gt 0

            foreach ($relative in $removed) {
                $filePath = Get-PluginFilePath -Root $root -RelativePath $relative
                if (Test-Path -LiteralPath $filePath) {
                    $verificationFailures += $relative
                }
            }
            if ($verificationFailures.Count -gt 0) {
                $exitCode = 5
            }
        }
    }

    $textFilesAfter = @(Get-ScannableFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $referencesAfter = @(Find-AssetReferences -Root $root -Files $textFilesAfter -Assets $selectedFiles -ExcludedFile $scriptRelativePath)
    Export-CsvReport -Path (Join-Path $ReportPath 'asset-references-after.csv') -Rows $referencesAfter

    $result = [pscustomobject]@{
        Success = $exitCode -eq 0
        Changed = $changed
        Skipped = $skipped
        SkipReason = $skipReason
        Operation = "PortalGui$Action"
        Portal = $Portal
        Scope = $Scope
        PluginRoot = $root
        OldManifestCount = $oldGraph.Count
        NewManifestCount = $newGraph.Count
        CommonManifestCount = $common.Count
        SelectedManifestCount = $selectedFiles.Count
        ExistingSelectedCount = $existingFiles.Count
        MissingSelectedCount = $missingFiles.Count
        RemovedCount = $removed.Count
        RestoredCount = $restored.Count
        LegacyClassReferenceCount = $legacyReferences.Count
        AssetReferenceBeforeCount = $referencesBefore.Count
        AssetReferenceAfterCount = $referencesAfter.Count
        VerificationFailures = @($verificationFailures)
        RemovedFiles = @($removed)
        RestoredFiles = @($restored)
        BackupDirectory = if ($backup) { $backup.Directory } else { $null }
        BackupZip = if ($backup) { $backup.Zip } else { $null }
        ReportPath = $ReportPath
        Message = if ($Action -eq 'Audit') {
            'Audit completed. Plugin files were not changed.'
        } elseif ($skipped) {
            $skipReason
        } elseif ($exitCode -eq 0) {
            "$Action completed and verified."
        } else {
            "$Action completed with verification failures."
        }
        ExitCode = $exitCode
    }

    Write-JsonReport -Path (Join-Path $ReportPath 'summary.json') -Value $result
    Complete-PortalGuiOperation -Result $result -ExitCode $exitCode
}
catch {
    $message = $_.Exception.Message
    $failure = [pscustomobject]@{
        Success = $false
        Changed = $false
        Skipped = $false
        SkipReason = $null
        Operation = "PortalGui$Action"
        Portal = $Portal
        Scope = $Scope
        PluginRoot = $RootPath
        ReportPath = $ReportPath
        Message = $message
        ExitCode = 1
    }

    if ($OutputFormat -eq 'Json') {
        $failure | ConvertTo-Json -Depth 8 -Compress
    } else {
        $failure
    }
    [Console]::Error.WriteLine($message)
    exit 1
}
