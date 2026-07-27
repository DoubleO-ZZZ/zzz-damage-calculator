param(
  [string]$Version = "3.0"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$enemyRoot = Join-Path $repoRoot "assets\nanoka\enemies"
$assetBase = "https://static.nanoka.cc/assets/zzz"
$maxAssetBytes = 2MB

$enemyAssets = [ordered]@{
  "30007" = "Monster_CottusGrey"
  "30009" = "Monster_ComplexCorrupted"
  "30012" = "Monster_Marionette_Twins"
  "30021" = "Monster_TyrantPompey"
  "30024" = "Monster_SacrificeBringer"
  "30032" = "Monster_Geppetto"
  "30033" = "Monster_MentorMevorakh"
  "30034" = "Monster_NamelessOne"
  "30038" = "Monster_IsoldetheDefiler"
  "30041" = "Monster_WanderingHunter"
  "30042" = "Monster_Awakener"
  "35001" = "Monster_Nineveh"
  "40000" = "Monster_Vessel"
  "40001" = "Monster_Vesper"
  "40002" = "Monster_GraymaneCenturion"
  "40003" = "Monster_ClonedBlackWolf"
  "40004" = "Monster_Pure"
  "40005" = "Monster_Mutant"
  "40006" = "Monster_Girtablu"
  "40007" = "Monster_Vessel_HC"
  "300071" = "Monster_Cottus"
  "300072" = "Monster_NotoriousDeadEndButcher"
  "300121" = "Monster_NotoriousMarionette"
  "300211" = "Monster_NotoriousPompey"
}

New-Item -ItemType Directory -Force -Path $enemyRoot | Out-Null

$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.UserAgent.ParseAdd(
  "DoubleO-ZZZ-Damage-Calculator/1.0 (+https://github.com/DoubleO-ZZZ/zzz-damage-calculator)"
)

function Get-Sha256 {
  param([byte[]]$Bytes)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

try {
  $manifestEntries = [System.Collections.Generic.List[object]]::new()

  foreach ($entry in $enemyAssets.GetEnumerator()) {
    $id = [string]$entry.Key
    $sourceIcon = [string]$entry.Value
    $url = "$assetBase/$sourceIcon.webp"
    $destination = Join-Path $enemyRoot "$id.webp"

    if (([Uri]$url).Host -ne "static.nanoka.cc") {
      throw "Unexpected asset host: $url"
    }

    $response = $client.GetAsync($url).GetAwaiter().GetResult()
    $response.EnsureSuccessStatusCode() | Out-Null
    $contentType = $response.Content.Headers.ContentType.MediaType
    $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()

    if ($contentType -ne "image/webp") {
      throw "Unexpected content type for $url`: $contentType"
    }
    if ($bytes.Length -lt 12 -or $bytes.Length -gt $maxAssetBytes) {
      throw "Unexpected asset size for $url`: $($bytes.Length)"
    }
    if (
      [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne "RIFF" -or
      [System.Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne "WEBP"
    ) {
      throw "Invalid WebP signature for $url"
    }

    $temporary = "$destination.download"
    [System.IO.File]::WriteAllBytes($temporary, $bytes)
    Move-Item -LiteralPath $temporary -Destination $destination -Force

    $manifestEntries.Add([ordered]@{
      kind = "enemy"
      id = $id
      sourceDataVersion = $Version
      sourceIcon = $sourceIcon
      sourceUrl = $url
      dataUrl = "https://static.nanoka.cc/zzz/$Version/ko/monster/$id.json"
      localPath = $destination.Substring($repoRoot.Length + 1).Replace("\", "/")
      bytes = $bytes.Length
      contentType = $contentType
      sha256 = Get-Sha256 -Bytes $bytes
      fetchedAt = [DateTimeOffset]::UtcNow.ToString("o")
    })
  }

  $manifest = [ordered]@{
    source = "https://zzz.nanoka.cc/"
    assetBase = $assetBase
    version = $Version
    generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    notice = "Fan-tool reference assets. Zenless Zone Zero assets are owned by HoYoverse/COGNOSPHERE."
    assets = $manifestEntries
  }
  $manifestPath = Join-Path $enemyRoot "source-manifest.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

  Write-Output "Downloaded $($enemyAssets.Count) S-rank enemy images."
  Write-Output "Manifest: $manifestPath"
} finally {
  $client.Dispose()
}
