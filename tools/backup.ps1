<#
  LocaStar backup - the database and every photo, to a dated folder on this PC.

  Why this exists: on Supabase's free plan the daily backups cannot be
  restored, so this is the only copy of the reviews, accounts, lists and
  photos people have added. Run it once a month (the reminder email says
  when). Takes a minute or two.

  Run from PowerShell:
      powershell -ExecutionPolicy Bypass -File tools\backup.ps1

  Needs pg_dump/psql 17 (PostgreSQL command-line tools, same major version as
  the database). One-time install:
      winget install --id PostgreSQL.PostgreSQL.17 --override "--mode unattended --unattendedmodeui none --disable-components server,pgAdmin,stackbuilder"

  It asks for the database password every time and never writes it anywhere.
  The connection string (without the password) is remembered next to the
  backups so next month you only type the password.

  What is saved:
    db.dump   the schemas that are ours: public (all app data), auth (the
              accounts), storage (which photo belongs where) and
              supabase_migrations (the schema history). Custom format: restore
              with pg_restore. Supabase's own internal schemas are left out on
              purpose; a new project already has them.
    photos\   every file in the public "media" bucket, at its own path.

  WARNING: The dump holds email addresses and password hashes. Keep the folder on
  this PC or an encrypted drive, never in the git repo, never shared.
#>

$ErrorActionPreference = 'Stop'

$Project = 'qjhyxbfdmkegpjetnpbo'
$Root = Join-Path $HOME 'LocaStar-backups'
$Saved = Join-Path $Root 'connection.txt'

# ---- tools --------------------------------------------------------------------
function Find-Tool($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $guess = "C:\Program Files\PostgreSQL\17\bin\$name.exe"
  if (Test-Path $guess) { return $guess }
  throw "$name not found. Install the PostgreSQL 17 command-line tools first (see the top of this script)."
}
$PgDump = Find-Tool 'pg_dump'
$Psql = Find-Tool 'psql'
$version = & $PgDump --version
if ($version -notmatch ' 1[7-9]\.') { throw "Need pg_dump 17 or newer, found: $version" }

# ---- connection -----------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $Root | Out-Null
$uri = $null
if (Test-Path $Saved) { $uri = (Get-Content $Saved -Raw).Trim() }
if (-not $uri) {
  Write-Host ''
  Write-Host 'Paste the SESSION POOLER connection string from Supabase:'
  Write-Host '  Dashboard -> your project -> Connect -> "Session pooler" -> URI'
  Write-Host '  (it looks like postgresql://postgres.qjhy...:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres)'
  $uri = (Read-Host 'Connection string').Trim()
}
# Never keep a password in the string itself: drop whatever sits between the
# user name and the @, placeholder or real.
$uri = $uri -replace '^(postgres(?:ql)?://[^:/@]+):[^@]*@', '$1@'
if ($uri -notmatch "^postgres(ql)?://postgres\.$Project@.+pooler\.supabase\.com:5432/postgres") {
  throw "That doesn't look like this project's session pooler string (port 5432). Nothing was saved."
}
Set-Content -Path $Saved -Value $uri -Encoding ascii

$secure = Read-Host 'Database password' -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

try {
  $stamp = Get-Date -Format 'yyyy-MM-dd'
  $Dest = Join-Path $Root $stamp
  $Photos = Join-Path $Dest 'photos'
  New-Item -ItemType Directory -Force -Path $Photos | Out-Null

  # ---- database -------------------------------------------------------------------
  Write-Host "`nDumping the database..."
  $dump = Join-Path $Dest 'db.dump'
  & $PgDump $uri --format=custom --no-owner --no-privileges `
      --schema=public --schema=auth --schema=storage --schema=supabase_migrations `
      --file=$dump
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE). Wrong password, or the connection string changed?" }

  # Counted from the live database so the summary can be compared with the dump.
  $counts = & $Psql $uri -At -c "select (select count(*) from public.locations), (select count(*) from public.reviews), (select count(*) from public.profiles), (select count(*) from public.lists)"
  $tables = (& "$(Split-Path $PgDump)\pg_restore.exe" --list $dump | Select-String ' TABLE DATA ').Count

  # ---- photos -------------------------------------------------------------------------
  Write-Host 'Downloading photos...'
  $names = & $Psql $uri -At -c "select name from storage.objects where bucket_id = 'media' order by name"
  if ($LASTEXITCODE -ne 0) { throw 'Could not list the photos.' }
  $base = "https://$Project.supabase.co/storage/v1/object/public/media/"
  $ok = 0; $failed = @()
  foreach ($name in $names) {
    if (-not $name) { continue }
    $target = Join-Path $Photos ($name -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    try {
      Invoke-WebRequest -Uri ($base + $name) -OutFile $target -UseBasicParsing
      $ok++
    } catch {
      $failed += $name
    }
  }

  # ---- summary ------------------------------------------------------------------------
  $c = $counts -split '\|'
  $dumpMb = [math]::Round((Get-Item $dump).Length / 1MB, 1)
  $photoMb = [math]::Round(((Get-ChildItem $Photos -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
  $summary = @"
LocaStar backup $stamp
Database: db.dump, $dumpMb MB, $tables tables with data
  places $($c[0]), reviews $($c[1]), accounts $($c[2]), lists $($c[3])
Photos: $ok of $(@($names | Where-Object { $_ }).Count) downloaded, $photoMb MB
Restore: pg_restore --no-owner --dbname=<new database> db.dump
"@
  if ($failed.Count -gt 0) { $summary += "`nFAILED photos:`n  " + ($failed -join "`n  ") }
  Set-Content -Path (Join-Path $Dest 'README.txt') -Value $summary -Encoding utf8
  Write-Host "`n$summary"
  Write-Host "`nSaved to $Dest"
  if ($failed.Count -gt 0) { Write-Warning "$($failed.Count) photo(s) failed. Run the script again to retry." }
}
finally {
  # The password leaves memory when the script ends, whatever happened above.
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
