param([string]$AppPath, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$taskName = 'Gobbler Moodle downloads'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output 'Automatic Moodle downloads removed. Downloaded files and Gobbler records are retained.'
  exit 0
}
if (!$AppPath -or !(Test-Path -LiteralPath $AppPath -PathType Leaf) -or [IO.Path]::GetFileName($AppPath) -ine 'Sync-my-L2P.exe') {
  throw 'Supply the installed official Sync-my-L2P executable.'
}
$app = (Resolve-Path -LiteralPath $AppPath).Path
$options = 'HKCU:\Software\Sync-my-L2P\Sync-my-L2P'
foreach ($option in @(@(($options + '\loginData'),'saveLoginData'),@(($options + '\automation'),'autoLoginOnStart'),@(($options + '\automation'),'autoSyncOnStart'),@(($options + '\automation'),'autoCloseAfterSync'))) {
  if ([string](Get-ItemPropertyValue -LiteralPath $option[0] -Name $option[1]) -notin @('true','1')) {
    throw 'In Sync-my-L2P enable Save, Login on program startup, Synchronization on startup and Close after synchronization, then exit the app to save its settings.'
  }
}
$action = New-ScheduledTaskAction -Execute $app -WorkingDirectory ([IO.Path]::GetDirectoryName($app))
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30))
)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Run the official RWTH downloader every 30 minutes while signed in. Gobbler reads downloaded PDFs locally.' -Force | Out-Null
Write-Output 'Official Moodle downloads scheduled every 30 minutes while signed in. No wake-from-sleep or university freshness guarantee.'
