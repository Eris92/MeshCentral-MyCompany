param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$NodeId,
    [Parameter(Mandatory = $true)][string]$TargetMeshId,
    [string]$Token = $env:APPROVALCENTER_API_TOKEN
)

if ([string]::IsNullOrWhiteSpace($Token)) { throw "Set APPROVALCENTER_API_TOKEN or pass -Token." }
$body = @{ type = 'moverequest'; requesterNote = 'Move requested through an external system.'; payload = @{ nodeId = $NodeId; targetMeshId = $TargetMeshId } } | ConvertTo-Json -Depth 8
$uri = $Server.TrimEnd('/') + '/approvalcenter/api/v1/requests'
Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $Token"; 'Idempotency-Key' = [guid]::NewGuid().ToString() } -ContentType 'application/json; charset=utf-8' -Body $body
