$root = Split-Path -Parent $PSScriptRoot

Push-Location "$root\\frontend"
npm run build
Pop-Location

$dist = Join-Path $root "frontend\\dist"
New-Item -ItemType Directory -Path $dist -Force | Out-Null

$extensionFiles = @(
  "frontend\\extension\\manifest.json",
  "frontend\\extension\\background.js",
  "frontend\\extension\\content.js",
  "frontend\\extension\\stop.html"
)

foreach ($file in $extensionFiles) {
  $src = Join-Path $root $file
  if (Test-Path $src) {
    Copy-Item -Force $src $dist
  }
}
