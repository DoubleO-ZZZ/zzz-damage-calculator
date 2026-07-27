param(
  [string]$Version = "3.0"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$catalogPath = Join-Path $repoRoot "src\data\catalog.js"
$assetRoot = Join-Path $repoRoot "assets\nanoka"
$characterRoot = Join-Path $assetRoot "characters"
$weaponRoot = Join-Path $assetRoot "weapons"
$discRoot = Join-Path $assetRoot "discs"
$dataBase = "https://static.nanoka.cc/zzz/$Version"
$assetBase = "https://static.nanoka.cc/assets/zzz"
$maxAssetBytes = 2MB

New-Item -ItemType Directory -Force -Path $characterRoot, $weaponRoot, $discRoot | Out-Null

$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.UserAgent.ParseAdd(
  "DoubleO-ZZZ-Damage-Calculator/1.0 (+https://github.com/DoubleO-ZZZ/zzz-damage-calculator)"
)

function Get-Utf8Json {
  param([string]$Url)

  $response = $client.GetAsync($Url).GetAwaiter().GetResult()
  $response.EnsureSuccessStatusCode() | Out-Null
  $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  return [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
}

function Get-Sha256 {
  param([byte[]]$Bytes)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Save-WebpAsset {
  param(
    [string]$Kind,
    [string]$Id,
    [string]$SourceIcon,
    [string]$Url,
    [string]$Destination
  )

  if (([Uri]$Url).Host -ne "static.nanoka.cc") {
    throw "Unexpected asset host: $Url"
  }

  $response = $client.GetAsync($Url).GetAwaiter().GetResult()
  $response.EnsureSuccessStatusCode() | Out-Null
  $contentType = $response.Content.Headers.ContentType.MediaType
  $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()

  if ($contentType -ne "image/webp") {
    throw "Unexpected content type for $Url`: $contentType"
  }
  if ($bytes.Length -lt 12 -or $bytes.Length -gt $maxAssetBytes) {
    throw "Unexpected asset size for $Url`: $($bytes.Length)"
  }
  $riff = [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4)
  $webp = [System.Text.Encoding]::ASCII.GetString($bytes, 8, 4)
  if ($riff -ne "RIFF" -or $webp -ne "WEBP") {
    throw "Invalid WebP signature for $Url"
  }

  $temporary = "$Destination.download"
  [System.IO.File]::WriteAllBytes($temporary, $bytes)
  Move-Item -LiteralPath $temporary -Destination $Destination -Force

  return [pscustomobject]@{
    kind = $Kind
    id = $Id
    sourceDataVersion = $Version
    sourceIcon = $SourceIcon
    sourceUrl = $Url
    localPath = $Destination.Substring($repoRoot.Length + 1).Replace("\", "/")
    bytes = $bytes.Length
    contentType = $contentType
    etag = if ($response.Headers.ETag) { $response.Headers.ETag.Tag } else { $null }
    lastModified = if ($response.Content.Headers.LastModified) {
      $response.Content.Headers.LastModified.ToString("o")
    } else {
      $null
    }
    sha256 = Get-Sha256 -Bytes $bytes
    fetchedAt = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

try {
  $characterSummary = Get-Utf8Json -Url "$dataBase/character.json"
  $weaponSummary = Get-Utf8Json -Url "$dataBase/weapon.json"
  $discSummary = Get-Utf8Json -Url "$dataBase/equipment.json"

  $catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8
  $weaponMarker = $catalog.IndexOf("export const WEAPONS")
  if ($weaponMarker -lt 0) {
    throw "Could not split character and W-Engine catalog."
  }
  $characterCatalog = $catalog.Substring(0, $weaponMarker)
  $weaponCatalog = $catalog.Substring($weaponMarker)
  $liveLinePattern = '\{ id: "(\d+)".*version: "3\.0 live"'
  $characterIds = [regex]::Matches($characterCatalog, $liveLinePattern) |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
  $weaponIds = [regex]::Matches($weaponCatalog, $liveLinePattern) |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
  $discIds = $discSummary.PSObject.Properties.Name | Sort-Object

  $manifestEntries = [System.Collections.Generic.List[object]]::new()

  foreach ($id in $characterIds) {
    $property = @($characterSummary.PSObject.Properties.Match([string]$id))[0]
    $entry = $property.Value
    if (-not $entry) { throw "Missing live character $id in Nanoka summary." }
    if ($entry.icon -notmatch '^IconRole(\d+)$') {
      throw "Unexpected character icon for $id`: $($entry.icon)"
    }
    $sourceIcon = "IconRoleCircle$($Matches[1])"
    $url = "$assetBase/$sourceIcon.webp"
    $destination = Join-Path $characterRoot "$id.webp"
    $manifestEntries.Add(
      (Save-WebpAsset -Kind "character" -Id $id -SourceIcon $sourceIcon -Url $url -Destination $destination)
    )
  }

  foreach ($id in $weaponIds) {
    $property = @($weaponSummary.PSObject.Properties.Match([string]$id))[0]
    $entry = $property.Value
    if (-not $entry) { throw "Missing live W-Engine $id in Nanoka summary." }
    $sourceIcon = [string]$entry.icon
    $url = "$assetBase/$([Uri]::EscapeDataString($sourceIcon)).webp"
    $destination = Join-Path $weaponRoot "$id.webp"
    $manifestEntries.Add(
      (Save-WebpAsset -Kind "weapon" -Id $id -SourceIcon $sourceIcon -Url $url -Destination $destination)
    )
  }

  foreach ($id in $discIds) {
    $property = @($discSummary.PSObject.Properties.Match([string]$id))[0]
    $entry = $property.Value
    $sourceIcon = [System.IO.Path]::GetFileNameWithoutExtension([string]$entry.icon)
    $url = "$assetBase/$([Uri]::EscapeDataString($sourceIcon)).webp"
    $destination = Join-Path $discRoot "$id.webp"
    $manifestEntries.Add(
      (Save-WebpAsset -Kind "disc" -Id $id -SourceIcon $sourceIcon -Url $url -Destination $destination)
    )
  }

  $manifest = [ordered]@{
    source = "https://zzz.nanoka.cc/"
    dataBase = $dataBase
    assetBase = $assetBase
    version = $Version
    generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    notice = "Fan-tool reference assets. Zenless Zone Zero assets are owned by HoYoverse/COGNOSPHERE."
    assets = $manifestEntries
  }
  $manifestPath = Join-Path $assetRoot "source-manifest.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

  Write-Output "Downloaded $($characterIds.Count) characters, $($weaponIds.Count) W-Engines, and $($discIds.Count) disc sets."
  Write-Output "Manifest: $manifestPath"
} finally {
  $client.Dispose()
}
