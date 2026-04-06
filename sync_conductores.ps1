param(
  [string]$CsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThNrFZLbNklMFtPeg0wF4TA1vZHnZ4YNMmGcnHfty_RoNuAQw__iV2GMXqTsv36MPiks1ARpYui1JK/pub?gid=0&single=true&output=csv",
  [int]$BatchSize = 500
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_URL) {
  throw "Falta SUPABASE_URL en variables de entorno."
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  throw "Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno."
}

Write-Host "Descargando CSV de conductores..."
$csvResponse = Invoke-WebRequest -Uri $CsvUrl -UseBasicParsing -TimeoutSec 60

if ($csvResponse.StatusCode -ne 200) {
  throw "No se pudo descargar CSV. HTTP $($csvResponse.StatusCode)"
}

$rows = $csvResponse.Content | ConvertFrom-Csv
if (-not $rows -or $rows.Count -eq 0) {
  throw "El CSV no trajo filas."
}

$payload = @()
foreach ($row in $rows) {
  $cedula = ($row.cedula | Out-String).Trim() -replace "\D", ""
  $nombre = ($row.nombre | Out-String).Trim()
  $status = (($row.status | Out-String).Trim()).ToUpper()

  if ([string]::IsNullOrWhiteSpace($cedula) -or [string]::IsNullOrWhiteSpace($nombre)) {
    continue
  }
  if ($status -ne "ENABLED" -and $status -ne "DISABLED") {
    $status = "DISABLED"
  }

  $payload += [PSCustomObject]@{
    cedula = $cedula
    nombre = $nombre
    status = $status
    updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }
}

if ($payload.Count -eq 0) {
  throw "No quedaron filas validas para sincronizar."
}

$url = "$($env:SUPABASE_URL)/rest/v1/calisoftware_conductores?on_conflict=cedula"
$headers = @{
  apikey        = $env:SUPABASE_SERVICE_ROLE_KEY
  Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
  Prefer        = "resolution=merge-duplicates,return=minimal"
  "Content-Type"= "application/json"
}

$total = $payload.Count
$index = 0
while ($index -lt $total) {
  $end = [Math]::Min($index + $BatchSize - 1, $total - 1)
  $chunk = $payload[$index..$end]
  $json = $chunk | ConvertTo-Json -Depth 4 -Compress

  Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $json -TimeoutSec 120 | Out-Null
  Write-Host "Upsert OK: $($index + 1)-$($end + 1) de $total"
  $index = $end + 1
}

Write-Host "Sincronizacion completada. Filas procesadas: $total"
