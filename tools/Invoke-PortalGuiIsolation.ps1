<#
.SYNOPSIS
Audits, removes or restores files used by the old native GUI or the new standalone SirK Portal.

.DESCRIPTION
Old means browser assets loaded by plugin-main.js. New means assets loaded by
public/portal-standalone.html and public/portal-login.html.

Exclusive selects files unique to the chosen GUI. Full includes shared files.
Remove always creates a directory backup, ZIP archive and SHA256 manifest.
The script never stops or restarts MeshCentral.
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

function Normalize-RelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $value = $Path.Replace([char]92, '/').Trim()
    while ($value.StartsWith('./', [StringComparison]::Ordinal)) {
        $value = $value.Substring(2)
    }
    return $value.TrimStart([char[]]@('/', [char]92))
}

function Test-LocalAssetToken {
    param([Parameter(Mandatory = $true)][string]$Token)

    $value = $Token.Trim()
    if ([string]::IsNullOrWhiteSpace($value)) { return $false }
    if ($value -match '^[a-z][a-z0-9+.-]*:' -or $value -match '^//' -or $value -match '^[a-zA-Z]:[\\/]') { return $false }
    if ($value -match '^__[^/]+__$' -or $value -match '^data:' -or $value -match '^blob:') { return $false }
    if ($value.Contains([char]0) -or $value.Contains('..')) { return $false }
    return $true
}

function Get-SafePluginPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if (-not (Test-LocalAssetToken -Token $RelativePath)) {
        throw "Unsafe or non-local relative path: $RelativePath"
    }

    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar))
    $relative = (Normalize-RelativePath -Path $RelativePath).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $candidate = [IO.Path]::GetFullPath((Join-Path -Path $rootFull -ChildPath $relative))
    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar

    if (-not $candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Resolved path escaped plugin root: $RelativePath"
    }
    return $candidate
}

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$FullPath
    )

    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar))
    $pathFull = [IO.Path]::GetFullPath($FullPath)
    $prefix = $rootFull + [IO.Path]::DirectorySeparatorChar
    if (-not $pathFull.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside plugin root: $pathFull"
    }
    return Normalize-RelativePath -Path $pathFull.Substring($prefix.Length)
}

function Write-JsonFile {
    param([string]$Path, $Value)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $utf8 = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 14), $utf8)
}

function Export-CsvFile {
    param([string]$Path, $Rows)
    $items = @($Rows)
    if ($items.Count -eq 0) {
        $utf8 = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($Path, '', $utf8)
    } else {
        $items | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
    }
}

function Get-AdminAssetMap {
    param([string]$Root)
    $source = [IO.File]::ReadAllText((Join-Path $Root 'SirkPlatformAdmin.js'))
    $map = @{}
    $pattern = '(?ms)"(?<asset>[^"]+)"\s*:\s*\[\s*"(?<path>[^"]+)"\s*,'
    foreach ($match in [regex]::Matches($source, $pattern)) {
        $asset = Normalize-RelativePath -Path $match.Groups['asset'].Value
        $path = Normalize-RelativePath -Path $match.Groups['path'].Value
        if ((Test-LocalAssetToken -Token $asset) -and (Test-LocalAssetToken -Token $path)) {
            $map[$asset.ToLowerInvariant()] = $path
        }
    }
    return $map
}

function Get-AssetTokens {
    param([string]$Text)
    $result = New-Object 'System.Collections.Generic.List[string]'
    $patterns = @(
        '(?i)["''](?<v>[^"'']+\.(?:js|css|html?|json|svg|png|jpe?g|webp))(?:\?[^"'']*)?["'']',
        '(?i)url\(\s*["'']?(?<v>[^\)"'']+\.(?:svg|png|jpe?g|webp))(?:\?[^\)"'']*)?["'']?\s*\)'
    )
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Text, $pattern)) {
            $token = $match.Groups['v'].Value.Trim()
            if (Test-LocalAssetToken -Token $token) { [void]$result.Add($token) }
        }
    }
    return @($result | Sort-Object -Unique)
}

function Resolve-Asset {
    param([string]$Root, [hashtable]$Map, [string]$Token)

    if (-not (Test-LocalAssetToken -Token $Token)) { return $null }
    $value = $Token.Replace([char]92, '/').Trim()
    $value = $value -replace '^__ASSET_BASE__/', ''
    $value = ($value -split '[?#]', 2)[0]
    if (-not (Test-LocalAssetToken -Token $value)) { return $null }
    $value = Normalize-RelativePath -Path $value

    $key = $value.ToLowerInvariant()
    if ($Map.ContainsKey($key)) {
        $mapped = Normalize-RelativePath -Path $Map[$key]
        $mappedPath = Get-SafePluginPath -Root $Root -RelativePath $mapped
        if (Test-Path -LiteralPath $mappedPath -PathType Leaf) { return $mapped }
    }

    $candidate = if ($value.StartsWith('public/', [StringComparison]::OrdinalIgnoreCase)) { $value } else { 'public/' + $value }
    if (-not (Test-LocalAssetToken -Token $candidate)) { return $null }
    $candidatePath = Get-SafePluginPath -Root $Root -RelativePath $candidate
    if (Test-Path -LiteralPath $candidatePath -PathType Leaf) { return Normalize-RelativePath -Path $candidate }
    return $null
}

function Expand-Graph {
    param([string]$Root, [hashtable]$Map, [string[]]$Seeds)

    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    $seen = @{}
    foreach ($seed in $Seeds) { if ($seed) { $queue.Enqueue((Normalize-RelativePath -Path $seed)) } }

    while ($queue.Count -gt 0) {
        $relative = Normalize-RelativePath -Path $queue.Dequeue()
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { continue }
        $full = Get-SafePluginPath -Root $Root -RelativePath $relative
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
        $seen[$key] = $relative

        if ([IO.Path]::GetExtension($full).ToLowerInvariant() -notin @('.js', '.css', '.html', '.htm')) { continue }
        foreach ($token in Get-AssetTokens -Text ([IO.File]::ReadAllText($full))) {
            $resolved = Resolve-Asset -Root $Root -Map $Map -Token $token
            if ($resolved -and -not $seen.ContainsKey($resolved.ToLowerInvariant())) { $queue.Enqueue($resolved) }
        }
    }
    return @($seen.Values | Sort-Object)
}

function Get-OldGraph {
    param([string]$Root, [hashtable]$Map)
    $source = [IO.File]::ReadAllText((Join-Path $Root 'plugin-main.js'))
    $start = $source.IndexOf('obj.onWebUIStartupEnd', [StringComparison]::Ordinal)
    $end = if ($start -ge 0) { $source.IndexOf('obj.goPageStart', $start, [StringComparison]::Ordinal) } else { -1 }
    if ($start -lt 0 -or $end -le $start) { throw 'Native browser bootstrap was not found in plugin-main.js.' }
    $seeds = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in Get-AssetTokens -Text $source.Substring($start, $end - $start)) {
        $resolved = Resolve-Asset -Root $Root -Map $Map -Token $token
        if ($resolved) { [void]$seeds.Add($resolved) }
    }
    return Expand-Graph -Root $Root -Map $Map -Seeds @($seeds)
}

function Get-NewGraph {
    param([string]$Root, [hashtable]$Map)
    return Expand-Graph -Root $Root -Map $Map -Seeds @('public/portal-standalone.html', 'public/portal-login.html')
}

function Get-TextFiles {
    param([string]$Root, [string[]]$ExcludedRoots)
    $extensions = @('.js', '.css', '.html', '.htm', '.handlebars', '.json', '.md', '.ps1', '.txt')
    $excluded = @($ExcludedRoots | Where-Object { $_ } | ForEach-Object { [IO.Path]::GetFullPath($_) })
    return @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
        if ($extensions -notcontains $_.Extension.ToLowerInvariant()) { return $false }
        if ($_.FullName -match '[\\/](?:\.git|node_modules)[\\/]') { return $false }
        foreach ($path in $excluded) { if ($_.FullName.StartsWith($path, [StringComparison]::OrdinalIgnoreCase)) { return $false } }
        return $true
    })
}

function Find-References {
    param([string]$Root, [IO.FileInfo[]]$Files, [string[]]$Assets)
    $rows = New-Object 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelativePath -Root $Root -FullPath $file.FullName
        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($asset in $Assets) {
                $name = [IO.Path]::GetFileName($asset)
                if ($line.IndexOf($asset, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or $line.IndexOf($name, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    [void]$rows.Add([pscustomobject]@{ Asset = $asset; File = $relativeFile; LineNumber = $lineNumber; Line = $line.Trim() })
                }
            }
        }
    }
    return @($rows)
}

function Find-LegacyClasses {
    param([string]$Root, [IO.FileInfo[]]$Files)
    $regex = '\b(?:style1|fullselect|semiselect|lbbuttonsel2?|lbtg|sirk-management-(?:shell|workspace|column|toolbar|item|list|tool|details|tree)|mc-shared-(?:page|layout|primary|secondary|details|nav-item|toolbar|card)|mc-approval-(?:nav-item|nav-icon|nav-label|provider|status)|btn-(?:primary|secondary|success|danger|warning|info|light|dark|sm|lg))\b'
    $rows = New-Object 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $relativeFile = Get-RelativePath -Root $Root -FullPath $file.FullName
        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            if ([regex]::IsMatch($line, $regex, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                [void]$rows.Add([pscustomobject]@{ File = $relativeFile; LineNumber = $lineNumber; Line = $line.Trim() })
            }
        }
    }
    return @($rows)
}

function New-Backup {
    param([string]$Root, [string]$DestinationRoot, [string]$PortalName, [string]$ScopeName, [string[]]$Files)
    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    $directory = Join-Path $DestinationRoot ('{0}-{1}-{2}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PortalName, $ScopeName)
    $fileRoot = Join-Path $directory 'files'
    New-Item -ItemType Directory -Path $fileRoot -Force | Out-Null
    $entries = New-Object 'System.Collections.Generic.List[object]'
    foreach ($relative in $Files) {
        $source = Get-SafePluginPath -Root $Root -RelativePath $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $destination = Get-SafePluginPath -Root $fileRoot -RelativePath $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
        [void]$entries.Add([pscustomobject]@{ RelativePath = $relative; Sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash })
    }
    $manifest = [pscustomobject]@{ SchemaVersion = 1; Portal = $PortalName; Scope = $ScopeName; CreatedAt = (Get-Date).ToString('o'); Files = @($entries) }
    Write-JsonFile -Path (Join-Path $directory 'manifest.json') -Value $manifest
    $zip = $directory + '.zip'
    Compress-Archive -Path (Join-Path $directory '*') -DestinationPath $zip -CompressionLevel Optimal -Force
    return [pscustomobject]@{ Directory = $directory; Zip = $zip }
}

function Restore-Backup {
    param([string]$Root, [string]$PortalName, [string]$Path)
    $temporary = $null
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $temporary = Join-Path ([IO.Path]::GetTempPath()) ('SirkPlatformRestore-' + [guid]::NewGuid().ToString('N'))
        Expand-Archive -LiteralPath $Path -DestinationPath $temporary -Force
        $base = $temporary
    } elseif (Test-Path -LiteralPath $Path -PathType Container) {
        $base = [IO.Path]::GetFullPath($Path)
    } else { throw 'BackupPath does not exist.' }

    try {
        $manifestFile = Get-ChildItem -LiteralPath $base -Filter manifest.json -Recurse -File | Select-Object -First 1
        if (-not $manifestFile) { throw 'manifest.json was not found in backup.' }
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        if ([string]$manifest.Portal -ne $PortalName) { throw "Backup portal '$($manifest.Portal)' does not match '$PortalName'." }
        $fileRoot = Join-Path (Split-Path -Parent $manifestFile.FullName) 'files'
        $restored = New-Object 'System.Collections.Generic.List[string]'
        foreach ($entry in @($manifest.Files)) {
            $relative = Normalize-RelativePath -Path ([string]$entry.RelativePath)
            $source = Get-SafePluginPath -Root $fileRoot -RelativePath $relative
            $destination = Get-SafePluginPath -Root $Root -RelativePath $relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination -Force
            if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne [string]$entry.Sha256) { throw "Hash mismatch after restore: $relative" }
            [void]$restored.Add($relative)
        }
        return @($restored)
    } finally {
        if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Recurse -Force }
    }
}

function Complete-Result {
    param($Result, [int]$Code)
    $Result.ExitCode = $Code
    if ($OutputFormat -eq 'Json') { $Result | ConvertTo-Json -Depth 14 -Compress } else { $Result }
    exit $Code
}

try {
    $root = [IO.Path]::GetFullPath($RootPath)
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Plugin root does not exist: $root" }
    foreach ($required in @('plugin-main.js', 'SirkPlatformAdmin.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $required) -PathType Leaf)) { throw "Required file is missing: $required" }
    }

    if (-not $BackupRoot) { $BackupRoot = Join-Path (Split-Path -Parent $root) 'SirkPlatform-PortalGuiBackups' }
    $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
    if (-not $ReportPath) { $ReportPath = Join-Path (Join-Path ([IO.Path]::GetTempPath()) 'SirkPlatform-PortalGuiAudit') ('{0}-{1}-{2}-{3}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Portal, $Scope, $Action) }
    $ReportPath = [IO.Path]::GetFullPath($ReportPath)
    New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null
    if ($Force) { $ConfirmPreference = 'None' }

    $changed = $false
    $skipped = $false
    $backup = $null
    $removed = New-Object 'System.Collections.Generic.List[string]'
    $restored = @()
    $exitCode = 0

    if ($Action -eq 'Restore') {
        if (-not $BackupPath) { throw 'BackupPath is required for Restore.' }
        if ($PSCmdlet.ShouldProcess($root, "Restore $Portal GUI from '$BackupPath'")) {
            $restored = @(Restore-Backup -Root $root -PortalName $Portal -Path $BackupPath)
            $changed = $restored.Count -gt 0
        } else { $skipped = $true; $exitCode = 10 }
    }

    if ($Action -ne 'Restore') {
        foreach ($document in @('public/portal-standalone.html', 'public/portal-login.html')) {
            if (-not (Test-Path -LiteralPath (Get-SafePluginPath -Root $root -RelativePath $document) -PathType Leaf)) { throw "Required portal document is missing: $document" }
        }
    }

    $map = Get-AdminAssetMap -Root $root
    $oldGraph = @(Get-OldGraph -Root $root -Map $map)
    $newGraph = @(Get-NewGraph -Root $root -Map $map)
    $oldSet = @{}; foreach ($item in $oldGraph) { $oldSet[$item.ToLowerInvariant()] = $item }
    $newSet = @{}; foreach ($item in $newGraph) { $newSet[$item.ToLowerInvariant()] = $item }
    $targetSet = if ($Portal -eq 'Old') { $oldSet } else { $newSet }
    $otherSet = if ($Portal -eq 'Old') { $newSet } else { $oldSet }
    $selected = New-Object 'System.Collections.Generic.List[string]'
    foreach ($key in $targetSet.Keys) {
        if (($Scope -eq 'Full' -or -not $otherSet.ContainsKey($key)) -and $targetSet[$key].StartsWith('public/', [StringComparison]::OrdinalIgnoreCase)) { [void]$selected.Add($targetSet[$key]) }
    }
    $selectedFiles = @($selected | Sort-Object -Unique)
    $existing = @($selectedFiles | Where-Object { Test-Path -LiteralPath (Get-SafePluginPath -Root $root -RelativePath $_) -PathType Leaf })

    $textFiles = @(Get-TextFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $refsBefore = @(Find-References -Root $root -Files $textFiles -Assets $selectedFiles)
    $legacy = @(Find-LegacyClasses -Root $root -Files $textFiles)
    Write-JsonFile -Path (Join-Path $ReportPath 'old-manifest.json') -Value $oldGraph
    Write-JsonFile -Path (Join-Path $ReportPath 'new-manifest.json') -Value $newGraph
    Write-JsonFile -Path (Join-Path $ReportPath 'selected-manifest.json') -Value $selectedFiles
    Export-CsvFile -Path (Join-Path $ReportPath 'asset-references-before.csv') -Rows $refsBefore
    Export-CsvFile -Path (Join-Path $ReportPath 'legacy-class-usage.csv') -Rows $legacy

    if ($Action -eq 'Remove') {
        if ($PSCmdlet.ShouldProcess($root, "Backup and remove $($existing.Count) $Portal GUI file(s), scope $Scope")) {
            if ($existing.Count -gt 0) {
                $backup = New-Backup -Root $root -DestinationRoot $BackupRoot -PortalName $Portal -ScopeName $Scope -Files $existing
                foreach ($relative in $existing) { Remove-Item -LiteralPath (Get-SafePluginPath -Root $root -RelativePath $relative) -Force; [void]$removed.Add($relative) }
                $changed = $removed.Count -gt 0
            }
        } else { $skipped = $true; $exitCode = 10 }
    }

    $textFilesAfter = @(Get-TextFiles -Root $root -ExcludedRoots @($BackupRoot, $ReportPath))
    $refsAfter = @(Find-References -Root $root -Files $textFilesAfter -Assets $selectedFiles)
    Export-CsvFile -Path (Join-Path $ReportPath 'asset-references-after.csv') -Rows $refsAfter

    $result = [pscustomobject]@{
        Success = $exitCode -eq 0
        Changed = $changed
        Skipped = $skipped
        Operation = "PortalGui$Action"
        Portal = $Portal
        Scope = $Scope
        PluginRoot = $root
        OldManifestCount = $oldGraph.Count
        NewManifestCount = $newGraph.Count
        SelectedManifestCount = $selectedFiles.Count
        RemovedCount = $removed.Count
        RestoredCount = $restored.Count
        LegacyClassReferenceCount = $legacy.Count
        AssetReferenceBeforeCount = $refsBefore.Count
        AssetReferenceAfterCount = $refsAfter.Count
        RemovedFiles = @($removed)
        RestoredFiles = @($restored)
        BackupDirectory = if ($backup) { $backup.Directory } else { $null }
        BackupZip = if ($backup) { $backup.Zip } else { $null }
        ReportPath = $ReportPath
        Message = if ($Action -eq 'Audit') { 'Audit completed. No plugin files were changed.' } elseif ($skipped) { 'Operation was not approved or was run with -WhatIf.' } else { "$Action completed." }
        ExitCode = $exitCode
    }
    Write-JsonFile -Path (Join-Path $ReportPath 'summary.json') -Value $result
    Complete-Result -Result $result -Code $exitCode
}
catch {
    $failure = [pscustomobject]@{ Success = $false; Changed = $false; Skipped = $false; Operation = "PortalGui$Action"; Portal = $Portal; Scope = $Scope; PluginRoot = $RootPath; ReportPath = $ReportPath; Message = $_.Exception.Message; ExitCode = 1 }
    if ($OutputFormat -eq 'Json') { $failure | ConvertTo-Json -Depth 8 -Compress } else { $failure }
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
