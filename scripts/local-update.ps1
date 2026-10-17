param([ValidateSet('Check','Apply')][string]$Action = 'Check')
$ErrorActionPreference = 'Stop'
$gobblerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $gobblerRoot
$gobblerNode = (Get-Command node -ErrorAction Stop | Select-Object -First 1).Source
$gobblerPnpm = (Get-Command pnpm -ErrorAction Stop | Select-Object -First 1).Source
$gobblerLocal = Join-Path $gobblerRoot '.wrangler/local'
$gobblerLauncher = Join-Path $gobblerLocal 'start-hidden.vbs'
foreach ($gobblerRequired in @('.dev.vars','pnpm-lock.yaml','.wrangler/local/config.json','.wrangler/local/start-hidden.vbs')) {
  if (!(Test-Path -LiteralPath (Join-Path $gobblerRoot $gobblerRequired))) { throw "Missing local setup: $gobblerRequired" }
}
& $gobblerNode -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Gobbler needs Node 24 or later.' }
function Invoke-GobblerPnpm([string[]]$Arguments) {
  & $gobblerPnpm @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'An update check failed. The verified backup remains available.' }
}
$gobblerDirty = & git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect this Gobbler checkout.' }
if ($Action -eq 'Check') {
  Write-Output 'Local setup and Node are available. Apply will verify a backup, stop Gobbler, install locked dependencies, test, build, migrate and restart.'
  if ($gobblerDirty) { Write-Output 'Save or commit local code changes before applying an update.' }
  Write-Output 'No files, records, processes or remote services were changed.'
  exit 0
}
if ($gobblerDirty) { throw 'Save or commit local code changes before applying an update.' }
$gobblerRunnerPid = $null
$gobblerLock = Join-Path $gobblerLocal 'runner.lock'
if (Test-Path -LiteralPath $gobblerLock) {
  $gobblerRunnerPid = [int]([IO.File]::ReadAllText($gobblerLock))
  $gobblerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$gobblerRunnerPid"
  $gobblerScriptPath = Join-Path $gobblerRoot 'scripts/local.ts'
  if ($gobblerProcess -and ($gobblerProcess.Name -ine 'node.exe' -or $gobblerProcess.CommandLine.Replace('/','\').IndexOf($gobblerScriptPath.Replace('/','\'), [StringComparison]::OrdinalIgnoreCase) -lt 0)) {
    throw 'The saved runner ID belongs to another process. Stop and inspect the local setup.'
  }
  if (!$gobblerProcess) { $gobblerRunnerPid = $null }
}
$gobblerOwned = [Collections.Generic.HashSet[int]]::new()
if ($gobblerRunnerPid) {
  [void]$gobblerOwned.Add($gobblerRunnerPid)
  $gobblerProcesses = Get-CimInstance Win32_Process
  do {
    $gobblerAdded = $false
    foreach ($gobblerChild in $gobblerProcesses) {
      if ($gobblerOwned.Contains([int]$gobblerChild.ParentProcessId) -and $gobblerOwned.Add([int]$gobblerChild.ProcessId)) { $gobblerAdded = $true }
    }
  } while ($gobblerAdded)
}
foreach ($gobblerListener in (Get-NetTCPConnection -LocalPort 5173,8787 -State Listen -ErrorAction SilentlyContinue)) {
  if (!$gobblerOwned.Contains([int]$gobblerListener.OwningProcess)) { throw 'Close manually started Gobbler servers before applying an update.' }
}
Invoke-GobblerPnpm -Arguments @('local','--backup')
if ($gobblerRunnerPid) {
  & taskkill /PID $gobblerRunnerPid /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not stop the identified Gobbler runner.' }
}
try {
  Invoke-GobblerPnpm -Arguments @('install','--frozen-lockfile')
  Invoke-GobblerPnpm -Arguments @('test')
  Invoke-GobblerPnpm -Arguments @('build')
  Invoke-GobblerPnpm -Arguments @('db:migrate')
  Start-Process -FilePath (Join-Path $env:WINDIR 'System32/wscript.exe') -ArgumentList ('"' + $gobblerLauncher + '"') -WindowStyle Hidden
  for ($gobblerAttempt = 0; $gobblerAttempt -lt 30; $gobblerAttempt++) {
    Start-Sleep -Seconds 1
    try {
      $gobblerStatus = Invoke-RestMethod 'http://127.0.0.1:5173/local-status' -TimeoutSec 2
      $gobblerHealth = Invoke-WebRequest 'http://127.0.0.1:8787/api/health' -TimeoutSec 2
      if ($gobblerStatus -and $gobblerHealth.StatusCode -eq 200 -and ([datetimeoffset]::UtcNow - [datetimeoffset]$gobblerStatus.heartbeat).TotalSeconds -lt 180) {
        Write-Output 'Gobbler restarted successfully. Open the app and verify your workspace and Sources.'
        exit 0
      }
    } catch { }
  }
  throw 'Gobbler did not become ready. Review the local runtime log before retrying.'
} catch {
  Write-Output 'The update stopped. Your database and verified backup remain available. Resolve the reported failure before restarting; no automatic rollback was attempted.'
  throw
}
