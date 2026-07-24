# Compatibility launcher. The implementation lives in tools/install.
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$Repository = 'https://github.com/Eris92/MeshCentral-MyCompany.git',
    [string]$Branch = 'main',
    [string]$MeshRoot = 'C:\Program Files\Open Source\MeshCentral',
    [string]$ServiceName = 'MeshCentral',
    [switch]$SkipTests
)

$target = Join-Path $PSScriptRoot 'tools\install\Install-SIRK-Portal-FromGit.ps1'
& $target @PSBoundParameters
exit $LASTEXITCODE
