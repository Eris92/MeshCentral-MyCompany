<#
.SYNOPSIS
Audits, removes or restores the old native GUI or the new standalone SirK Portal assets.

.DESCRIPTION
The file lists are discovered from the real loading chains instead of a fixed manual list:

- Old: browser assets loaded by plugin-main.js.
- New: assets loaded by public/portal-standalone.html and public/portal-login.html.

Exclusive scope selects only files not used by the other GUI.
Full scope selects the complete dependency graph, including shared files.

Remove always creates:
- a directory backup,
- a ZIP backup,
- manifest.json with SHA256 hashes,
- reports with remaining asset references and legacy class usage.

The script never restarts MeshCentral.

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

function Normalize-Rel {
    param([Parameter(Mandatory = $true)][string]$Path)

    $value = $Path.Replace([char]92, '/').Trim()
    while ($value.StartsWith('./', [StringComparison]::Ordinal)) {
        $value = $value.Substring(2)
    }
    return $value.TrimStart([char[]]@('/', [char]92))
}

function Join-PluginPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Relative
    )

    $native = (Normalize-Rel $Relative).Replace('/', [IO.Path]::DirectorySeparatorChar)
    return [IO.Path]::GetFullPath((Join-Path $Root $native))
}

function Test-InRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $trimChars = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd($trimChars)
    $pathFull = [IO.Path]::GetFullPath($Path)
    if ($pathFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return $pathFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

function Get-RelFromRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $trimChars = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd($trimChars)
    $pathFull = [IO.Path]::GetFullPath($Path)
    if (-not (Test-InRoot -Root $rootFull -Path $pathFull)) {
        throw "Path is outside plugin root: $pathFull"
    }
    return Normalize-Rel $pathFull.Substring($rootFull.Length)
}

function Read-Text {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [IO.File]::ReadAllText($Path)
}

function Write-Json {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowNull()][AllowEmptyCollection()]$Value
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $json = ConvertTo-Json -InputObject $Value -Depth 14
    [IO.File]::WriteAllText($Path, $json, (New-Object Text.UTF8Encoding($false)))
}

function Export-Rows {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Rows
    )

    $rowsArray = @($Rows)
    if ($rowsArray.Count -eq 0) {
        [IO.File]::WriteAllText($Path, '', (New-Object Text.UTF8Encoding($false)))
        return
    }
    $rowsArray | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
}

function Get-AssetMap {
    param([Parameter(Mandatory = $true)][string]$Root)

    $source = Read-Text (Join-Path $Root 'MyCompanyAdmin.js')
    $map = @{}
    $pattern = '(?ms)"(?<asset>[^"]+)"\s*:\s*\[\s*"(?<path>[^"]+)"\s*,'

    foreach ($match in [regex]::Matches($source, $pattern)) {
        $key = (Normalize-Rel $match.Groups['asset'].Value).ToLowerInvariant()
        $map[$key] = Normalize-Rel $match.Groups['path'].Value
    }
    return $map
}

function Get-AssetTokens {
    param([Parameter(Mandatory = $true)][string]$Text)

    $tokens = New-Object 'System.Collections.Generic.List[string]'
    $quoted = '(?i)["''](?<value>[^"'']+\.(?:js|css|html?|json|svg|png|jpe?g|webp))(?:\?[^"'']*)?["'']'
    $cssUrl = '(?i)url\(\s*["'']?(?<value>[^\)"'']+\.(?:svg|png|jpe?g|webp))(?:\?[^\)"'']*)?["'']?\s*\)'

    foreach ($match in [regex]::Matches($Text, $quoted)) {
        [void]$tokens.Add($match.Groups['value'].Value)
    }
    foreach ($match in [regex]::Matches($Text, $cssUrl)) {
        [void]$tokens.Add($match.Groups['value'].Value)
    }

    return @($tokens | Sort-Object -Unique)
}

function Resolve-Asset {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$Map,
        [Parameter(Mandatory = $true)][string]$Token
    )

    $value = $Token.Replace([char]92, '/').Trim()
    $value = $value -replace '^__ASSET_BASE__/', ''
    $value = ($value -split '[?#]', 2)[0]
    $value = Normalize-Rel $value
    if (-not $value -or $value.Contains('..')) { return $null }

    $key = $value.ToLowerInvariant()
    if ($Map.ContainsKey($key)) {
        $mapped = Normalize-Rel $Map[$key]
        if (Test-Path -LiteralPath (Join-PluginPath -Root $Root -Relative $mapped) -PathType Leaf) {
            return $mapped
        }
    }

    $candidates = @()
    if ($value.StartsWith('public/', [StringComparison]::OrdinalIgnoreCase)) {
        $candidates += $value
    } else {
        $candidates += 'public/' + $value
    }

    foreach ($candidate in $candidates) {
        $full = Join-PluginPath -Root $Root -Relative $candidate
        if ((Test-InRoot -Root $Root -Path $full) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
            return Normalize-Rel $candidate
        }
    }

    return $null
}

function Expand-Graph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$Map,
        [Parameter(Mandatory = $true)][string[]]$Seeds
    )

    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $seen = @{}

    foreach ($seed in $Seeds) {
        if ($seed) { $queue.Enqueue((Normalize-Rel $seed)) }
    }

    while ($queue.Count -gt 0) {
        $relative = Normalize-Rel $queue.Dequeue()
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { continue }

        $full = Join-PluginPath -Root $Root -Relative $relative
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
        if (-not (Test-InRoot -Root $Root -Path $full)) {
            throw "Resolved asset escaped plugin root: $relative"
        }

        $seen[$key] = $relative
        if ([IO.Path]::GetExtension($full).ToLowerInvariant() -notin @('.js', '.css', '.html', '.htm')) {
            continue
        }

        foreach ($token in Get-AssetTokens (Read-Text $full)) {
            $resolved = Resolve-Asset -Root $Root -Map $Map -Token $token
            if ($resolved -and -not $seen.ContainsKey($resolved.ToLowerInvariant())) {
                $queue.Enqueue($resolved)
            }
        }
    }

    return @($seen.Values | Sort-Object)
}

function Get-OldGraph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$Map
    )

    $source = Read-Text (Join-Path $Root 'plugin-main.js')
    $start = $source.IndexOf('obj.onWebUIStartupEnd', [StringComparison]::Ordinal)
    $end = if ($start -ge 0) { $source.IndexOf('obj.goPageStart', $start, [StringComparison]::Ordinal) } else { -1 }
    if ($start -lt 0 -or $end -le $start) {
        throw 'Native browser bootstrap was not found in plugin-main.js.'
    }

    $seeds = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in Get-AssetTokens $source.Substring($start, $end - $start)) {
        $resolved = Resolve-Asset -Root $Root -Map $Map -Token $token
        if ($resolved) { [void]$seeds.Add($resolved) }
    }

    return Expand-Graph -Root $Root -Map $Map -Seeds @($seeds)
}

function Get-NewGraph {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][hashtable]$Map
    )

    return Expand-Graph -Root $Root -Map $Map -Seeds @(
        'public/portal-standalone.html',
        'public/portal-login.html'
    )
}

function Convert-ToSet {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Values)

    $set = @{}
    foreach ($value in $Values) {
        $normalized = Normalize-Rel $value
        $set[$normalized.ToLowerInvariant()] = $normalized
    }
    return $set
}

function Get-TextFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [string[]]$ExcludedRoots = @()
    )

    $extensions = @('.js', '.css', '.html', '.htm', '.handlebars', '.json', '.md', '.ps1', '.txt')
    $excluded = @($ExcludedRoots | Where-Object { $_ } | ForEach-Object { [IO.Path]::GetFullPath($_) })

    return @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
        $item = $_
        if ($extensions -notcontains $item.Extension.ToLowerInvariant()) { return $false }
        if ($item.FullName -match '[\\/](?:\.git|node_modules)[\\/]') { return $false }
        foreach ($excludedRoot in $excluded) {
            if ($item.FullName.StartsWith($excludedRoot, [StringComparison]::OrdinalIgnoreCase)) {
                return $false
            }
        }
        return $true
    })
}

function Find-AssetRefs {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][IO.FileInfo[]]$Files,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Assets,
        [string]$ExcludeFile
    )

    $rows = New-Object 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelFromRoot -Root $Root -Path $file.FullName
        if ($ExcludeFile -and $relativeFile.Equals($ExcludeFile, [StringComparison]::OrdinalIgnoreCase)) { continue }

        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($asset in $Assets) {
                $normalized = Normalize-Rel $asset
                $fileName = [IO.Path]::GetFileName($normalized)
                if ($line.IndexOf($normalized, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
                    $line.IndexOf($fileName, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
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

function Find-LegacyRefs {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][IO.FileInfo[]]$Files,
        [string]$ExcludeFile
    )

    $patterns = @(
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Native selection classes'; Regex = '\b(?:style1|fullselect|semiselect|lbbuttonsel2?|lbtg)\b' },
        [pscustomobject]@{ Category = 'NativeMeshLegacy'; Name = 'Native menu identifiers'; Regex = '\b(?:MainMenuMyCompany|LeftMenuMyCompany|MainMenuMyDevices|LeftMenuMyDevices)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Management compatibility classes'; Regex = '\bsirk-management-(?:shell|workspace|column|toolbar|item|list|tool|details|tree)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'SharedPage compatibility classes'; Regex = '\bmc-shared-(?:page|layout|primary|secondary|details|nav-item|toolbar|card)\b' },
        [pscustomobject]@{ Category = 'PortalCompatibility'; Name = 'Approval compatibility classes'; Regex = '\bmc-approval-(?:nav-item|nav-icon|nav-label|provider|status)\b' },
        [pscustomobject]@{ Category = 'BootstrapCompatibility'; Name = 'Bootstrap button classes'; Regex = '\bbtn-(?:primary|secondary|success|danger|warning|info|light|dark|sm|lg)\b' }
    )

    $rows = New-Object 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelFromRoot -Root $Root -Path $file.FullName
        if ($ExcludeFile -and $relativeFile.Equals($ExcludeFile, [StringComparison]::OrdinalIgnoreCase)) { continue }

        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($pattern in $patterns) {
                if ([regex]::IsMatch($line, $pattern.Regex, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
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

function New-PortalBackup {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$DestinationRoot,
        [Parameter(Mandatory = $true)][string]$PortalName,
        [Parameter(Mandatory = $true)][string]$ScopeName,
        [Parameter(Mandatory = $true)][string[]]$Files
    )

    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    $id = '{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PortalName, $ScopeName
    $directory = Join-Path $DestinationRoot $id
    $fileRoot = Join-Path $directory 'files'
    New-Item -ItemType Directory -Path $fileRoot -Force | Out-Null

    $entries = New-Object 'System.Collections.Generic.List[object]'
    foreach ($relative in $Files) {
        $source = Join-PluginPath -Root $Root -Relative $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }

        $destination = Join-PluginPath -Root $fileRoot -Relative $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force

        [void]$entries.Add([pscustomobject]@{
            RelativePath = Normalize-Rel $relative
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
    Write-Json -Path (Join-Path $directory 'manifest.json') -Value $manifest

    $zip = $directory + '.zip'
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -Path (Join-Path $directory '*') -DestinationPath $zip -CompressionLevel Optimal

    return [pscustomobject]@{
        Directory = $directory
        Zip = $zip
        Manifest = $manifest
    }
}

function Open-Backup {
    param([Parameter(Mandatory = $true)][string]$Path)

    $full = [IO.Path]::GetFullPath($Path)
    if (Test-Path -LiteralPath $full -PathType Container) {
        return [pscustomobject]@{ Directory = $full; Temporary = $false }
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf) -or [IO.Path]::GetExtension($full) -ne '.zip') {
        throw 'BackupPath must point to an existing backup directory or ZIP file.'
    }

    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('MyCompany-PortalRestore-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary -Force | Out-Null
    Expand-Archive -LiteralPath $full -DestinationPath $temporary -Force
    return [pscustomobject]@{ Directory = $temporary; Temporary = $true }
}

function Restore-PortalBackup {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$PortalName,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $opened = Open-Backup $Path
    try {
        $manifestFile = Get-ChildItem -LiteralPath $opened.Directory -Filter manifest.json -Recurse -File | Select-Object -First 1
        if (-not $manifestFile) { throw 'manifest.json was not found in the backup.' }

        $backupDirectory = Split-Path -Parent $manifestFile.FullName
        $fileRoot = Join-Path $backupDirectory 'files'
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        if ([string]$manifest.Portal -ne $PortalName) {
            throw "Backup Portal '$($manifest.Portal)' does not match '$PortalName'."
        }

        $restored = New-Object 'System.Collections.Generic.List[string]'
        foreach ($entry in @($manifest.Files)) {
            $relative = Normalize-Rel ([string]$entry.RelativePath)
            $source = Join-PluginPath -Root $fileRoot -Relative $relative
            $destination = Join-PluginPath -Root $Root -Relative $relative
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
                throw "Backup file is missing: $relative"
            }

            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination -Force
            if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne [string]$entry.Sha256) {
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

function Complete-Script {
    param(
        [Parameter(Mandatory = $true)]$Result,
        [Parameter(Mandatory = $true)][int]$Code
    )

    $Result.ExitCode = $Code
    if ($OutputFormat -eq 'Json') {
        $Result | ConvertTo-Json -Depth 14 -Compress
    } else {
        $Result
    }
    exit $Code
}

try {
    $root = [IO.Path]::GetFullPath($RootPath)
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        throw "Plugin root does not exist: $root"
    }

    foreach ($required in @('plugin-main.js', 'MyCompanyAdmin.js')) {
        if (-not (Test-Path -LiteralPath (Join-PluginPath -Root $root -Relative $required) -PathType Leaf)) {
            throw "Required MyCompany file is missing: $required"
        }
    }

    if (-not $BackupRoot) {
        $BackupRoot = Join-Path (Split-Path -Parent $root) 'MyCompany-PortalGuiBackups'
    }
    $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)

    if (-not $ReportPath) {
        $reportName = '{0}-{1}-{2}-{3}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Portal, $Scope, $Action
        $ReportPath = Join-Path (Join-Path ([IO.Path]::GetTempPath()) 'MyCompany-PortalGuiAudit') $reportName
    }
    $ReportPath = [IO.Path]::GetFullPath($ReportPath)
    New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null

    if ($Force) { $ConfirmPreference = 'None' }

    $changed = $false
    $skipped = $false
    $skipReason = $null
    $exitCode = 0
    $backup = $null
    $removed = New-Object 'System.Collections.Generic.List[string]'
    $restored = @()
    $verificationFailures = @()

    if ($Action -eq 'Restore') {
        if (-not $BackupPath) { throw 'BackupPath is required for Restore.' }
        if (-not $PSCmdlet.ShouldProcess($root, "Restore $Portal GUI files from '$BackupPath'")) {
            $skipped = $true
            $skipReason = 'Restore was not approved or was run with -WhatIf.'
            $exitCode = 10
        } else {
            $restored = @(Restore-PortalBackup -Root $root -PortalName $Portal -Path $BackupPath)
            $changed = $restored.Count -gt 0
        }
    }

    $portalDocuments = @('public/portal-standalone.html', 'public/portal-login.html')
    if ($Action -ne 'Restore' -or -not $skipped) {
        foreach ($document in $portalDocuments) {
            if (-not (Test-Path -LiteralPath (Join-PluginPath -Root $root -Relative $document) -PathType Leaf)) {
                throw "Required Portal document is missing: $document. Use Restore with the matching backup first."
            }
        }
    }

    $map = Get-AssetMap $root
    $oldGraph = @(Get-OldGraph -Root $root -Map $map)
    $newGraph = @(Get-NewGraph -Root $root -Map $map)
    $oldSet = Convert-ToSet $oldGraph
    $newSet = Convert-ToSet $newGraph

    $common = New-Object 'System.Collections.Generic.List[string]'
    foreach ($key in $oldSet.Keys) {
        if ($newSet.ContainsKey($key)) { [void]$common.Add($oldSet[$key]) }
    }

    $targetSet = if ($Portal -eq 'Old') { $oldSet } else { $newSet }
    $otherSet = if ($Portal -eq 'Old') { $newSet } else { $oldSet }
    $selected = New-Object 'System.Collections.Generic.List[string]'

    foreach ($key in $targetSet.Keys) {
        if ($Scope -eq 'Full' -or -not $otherSet.ContainsKey($key)) {
            $relative = $targetSet[$key]
            if ($relative.StartsWith('public/', [StringComparison]::OrdinalIgnoreCase)) {
                [void]$selected.Add($relative)
            }
        }
    }

    $selectedFiles = @($selected | Sort-Object -Unique)
    $existing = @($selectedFiles | Where-Object {
        Test-Path -LiteralPath (Join-PluginPath -Root $root -Relative $_) -PathType Leaf
    })
    $missing = @($selectedFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-PluginPath -Root $root -Relative $_) -PathType Leaf)
    })

    $scriptRelative = $null
    if ($PSCommandPath -and (Test-InRoot -Root $root -Path $PSCommandPath)) {
        $scriptRelative = Get-RelFromRoot -Root $root -Path $PSCommandPath
    }

    $textFiles = @(Get-TextFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $refsBefore = @(Find-AssetRefs -Root $root -Files $textFiles -Assets $selectedFiles -ExcludeFile $scriptRelative)
    $legacyRefs = @(Find-LegacyRefs -Root $root -Files $textFiles -ExcludeFile $scriptRelative)

    Write-Json -Path (Join-Path $ReportPath 'old-manifest.json') -Value $oldGraph
    Write-Json -Path (Join-Path $ReportPath 'new-manifest.json') -Value $newGraph
    Write-Json -Path (Join-Path $ReportPath 'common-manifest.json') -Value @($common | Sort-Object -Unique)
    Write-Json -Path (Join-Path $ReportPath 'selected-manifest.json') -Value $selectedFiles
    Export-Rows -Path (Join-Path $ReportPath 'asset-references-before.csv') -Rows $refsBefore
    Export-Rows -Path (Join-Path $ReportPath 'legacy-class-usage.csv') -Rows $legacyRefs

    if ($Action -eq 'Remove') {
        $description = "Backup and remove $($existing.Count) $Portal GUI file(s), scope $Scope"
        if (-not $PSCmdlet.ShouldProcess($root, $description)) {
            $skipped = $true
            $skipReason = 'Remove was not approved or was run with -WhatIf.'
            $exitCode = 10
        } elseif ($existing.Count -gt 0) {
            $backup = New-PortalBackup -Root $root -DestinationRoot $BackupRoot -PortalName $Portal -ScopeName $Scope -Files $existing
            foreach ($relative in $existing) {
                Remove-Item -LiteralPath (Join-PluginPath -Root $root -Relative $relative) -Force
                [void]$removed.Add($relative)
            }
            $changed = $removed.Count -gt 0

            foreach ($relative in $removed) {
                if (Test-Path -LiteralPath (Join-PluginPath -Root $root -Relative $relative)) {
                    $verificationFailures += $relative
                }
            }
            if ($verificationFailures.Count -gt 0) { $exitCode = 5 }
        }
    }

    $textFilesAfter = @(Get-TextFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $refsAfter = @(Find-AssetRefs -Root $root -Files $textFilesAfter -Assets $selectedFiles -ExcludeFile $scriptRelative)
    Export-Rows -Path (Join-Path $ReportPath 'asset-references-after.csv') -Rows $refsAfter

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
        ExistingSelectedCount = $existing.Count
        MissingSelectedCount = $missing.Count
        RemovedCount = $removed.Count
        RestoredCount = $restored.Count
        LegacyClassReferenceCount = $legacyRefs.Count
        AssetReferenceBeforeCount = $refsBefore.Count
        AssetReferenceAfterCount = $refsAfter.Count
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

    Write-Json -Path (Join-Path $ReportPath 'summary.json') -Value $result
    Complete-Script -Result $result -Code $exitCode
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
