#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$MeshDataRoot = 'C:\Program Files\Open Source\MeshCentral\meshcentral-data',
    [switch]$ReplaceSeed,
    [switch]$ReplaceRuntime
)

$ErrorActionPreference = 'Stop'

$PluginsRoot = Join-Path $MeshDataRoot 'plugins'
$MyCompanyRoot = Join-Path $PluginsRoot 'MyCompany'

if (-not (Test-Path -LiteralPath $MyCompanyRoot -PathType Container)) {
    $MyCompanyRoot = Join-Path $PluginsRoot 'mycompany'
}

if (-not (Test-Path -LiteralPath $MyCompanyRoot -PathType Container)) {
    throw "Nie znaleziono katalogu MyCompany w: $PluginsRoot"
}

function Get-FirstExistingDirectory {
    param([string[]]$Candidates)

    foreach ($Candidate in $Candidates) {
        if (Test-Path -LiteralPath $Candidate -PathType Container) {
            return $Candidate
        }
    }

    return $null
}

function Copy-Library {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$Source,

        [Parameter(Mandatory)]
        [string]$SeedDestination,

        [Parameter(Mandatory)]
        [string]$RuntimeDestination
    )

    Write-Host ""
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    Write-Host "Source:  $Source"
    Write-Host "Seed:    $SeedDestination"
    Write-Host "Runtime: $RuntimeDestination"

    foreach ($Destination in @($SeedDestination, $RuntimeDestination)) {
        New-Item -Path $Destination -ItemType Directory -Force | Out-Null
    }

    $CommonArguments = @(
        $Source,
        $SeedDestination,
        '/E',
        '/COPY:DAT',
        '/DCOPY:DAT',
        '/R:2',
        '/W:1',
        '/NP',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS'
    )

    if ($ReplaceSeed) {
        $CommonArguments += '/PURGE'
    }

    & robocopy.exe @CommonArguments | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy seed failed for $Name. ExitCode: $LASTEXITCODE"
    }

    $RuntimeArguments = @(
        $Source,
        $RuntimeDestination,
        '/E',
        '/COPY:DAT',
        '/DCOPY:DAT',
        '/R:2',
        '/W:1',
        '/NP',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS'
    )

    if ($ReplaceRuntime) {
        $RuntimeArguments += '/PURGE'
    }

    & robocopy.exe @RuntimeArguments | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy runtime failed for $Name. ExitCode: $LASTEXITCODE"
    }

    $SeedFiles = @(
        Get-ChildItem -LiteralPath $SeedDestination -File -Recurse -ErrorAction SilentlyContinue
    ).Count
    $RuntimeFiles = @(
        Get-ChildItem -LiteralPath $RuntimeDestination -File -Recurse -ErrorAction SilentlyContinue
    ).Count

    Write-Host "Seed files:    $SeedFiles" -ForegroundColor Green
    Write-Host "Runtime files: $RuntimeFiles" -ForegroundColor Green
}

$MyScriptsSource = Get-FirstExistingDirectory -Candidates @(
    (Join-Path $PluginsRoot 'myscripts\scripts'),
    (Join-Path $PluginsRoot 'myscripts.disabled\scripts'),
    (Join-Path $PluginsRoot 'myscripts-disabled\scripts'),
    (Join-Path $PluginsRoot 'MyScripts\scripts'),
    (Join-Path $PluginsRoot 'MyScripts.disabled\scripts')
)

$MyCommandsSource = Get-FirstExistingDirectory -Candidates @(
    (Join-Path $PluginsRoot 'mycommands\scripts'),
    (Join-Path $PluginsRoot 'mycommands.disabled\scripts'),
    (Join-Path $PluginsRoot 'mycommands-disabled\scripts'),
    (Join-Path $PluginsRoot 'MyCommands\scripts'),
    (Join-Path $PluginsRoot 'MyCommands.disabled\scripts'),
    (Join-Path $PluginsRoot 'commandtabs\scripts'),
    (Join-Path $PluginsRoot 'commandtabs.disabled\scripts'),
    (Join-Path $PluginsRoot 'CommandTabs\scripts')
)

if (-not $MyScriptsSource) {
    throw 'Nie znaleziono oryginalnego katalogu scripts wtyczki MyScripts.'
}

if (-not $MyCommandsSource) {
    throw 'Nie znaleziono oryginalnego katalogu scripts wtyczki MyCommands/CommandTabs.'
}

Copy-Library `
    -Name 'MyScripts' `
    -Source $MyScriptsSource `
    -SeedDestination (Join-Path $MyCompanyRoot 'seed\MyScripts') `
    -RuntimeDestination (Join-Path $MeshDataRoot 'mycompany-data\myscripts\scripts')

Copy-Library `
    -Name 'MyCommands' `
    -Source $MyCommandsSource `
    -SeedDestination (Join-Path $MyCompanyRoot 'seed\MyCommands') `
    -RuntimeDestination (Join-Path $MeshDataRoot 'mycompany-data\scripts\MyCommands')

Write-Host ''
Write-Host 'Synchronizacja zakonczona.' -ForegroundColor Green
Write-Host 'Zrestartuj MeshCentral i wykonaj Ctrl+F5.'
