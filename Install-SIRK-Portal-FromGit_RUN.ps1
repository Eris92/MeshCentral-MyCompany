# Compatibility launcher. The implementation lives in tools/install.
Set-ExecutionPolicy Bypass -Scope Process -Force
& (Join-Path $PSScriptRoot 'tools\install\Install-SIRK-Portal-FromGit_RUN.ps1')
