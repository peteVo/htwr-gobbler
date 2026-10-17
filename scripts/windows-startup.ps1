param([switch]$Remove, [string]$UserId)
$ErrorActionPreference = 'Stop'
$gobblerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gobblerLocal = Join-Path $gobblerRoot '.wrangler\local'
$gobblerShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'Gobbler.lnk'
if ($Remove) {
    if (Test-Path -LiteralPath $gobblerShortcut) { Remove-Item -LiteralPath $gobblerShortcut }
    Write-Output 'Gobbler sign-in startup removed. The current runner is unchanged.'
    exit
}
if ($UserId) {
    [void][Guid]::Parse($UserId)
    New-Item -ItemType Directory -Path $gobblerLocal -Force | Out-Null
    @{ user_id = $UserId } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $gobblerLocal 'config.json')
}
if (-not (Test-Path -LiteralPath (Join-Path $gobblerLocal 'config.json'))) { throw 'Choose a local workspace with -UserId before installing startup.' }
$gobblerNode = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$gobblerIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$gobblerAcl = Get-Acl -LiteralPath $gobblerLocal
$gobblerAcl.SetAccessRuleProtection($true, $false)
foreach ($gobblerExistingRule in @($gobblerAcl.Access)) { [void]$gobblerAcl.RemoveAccessRuleSpecific($gobblerExistingRule) }
foreach ($gobblerSid in @($gobblerIdentity, [Security.Principal.SecurityIdentifier]'S-1-5-18')) {
    $gobblerRule = New-Object Security.AccessControl.FileSystemAccessRule($gobblerSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $gobblerAcl.AddAccessRule($gobblerRule)
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($gobblerLocal), $gobblerAcl)
$gobblerArgs = '"' + $gobblerNode + '" "' + (Join-Path $gobblerRoot 'node_modules\tsx\dist\cli.mjs') + '" "' + (Join-Path $gobblerRoot 'scripts\local.ts') + '"'
$gobblerVbs = Join-Path $gobblerLocal 'start-hidden.vbs'
@('Set shell = CreateObject("WScript.Shell")', ('shell.CurrentDirectory = "' + $gobblerRoot.Replace('"','""') + '"'), ('shell.Run "' + $gobblerArgs.Replace('"','""') + '", 0, False')) | Set-Content -LiteralPath $gobblerVbs
$gobblerShell = New-Object -ComObject WScript.Shell
$gobblerLink = $gobblerShell.CreateShortcut($gobblerShortcut)
$gobblerLink.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$gobblerLink.Arguments = '"' + $gobblerVbs + '"'
$gobblerLink.WorkingDirectory = $gobblerRoot
$gobblerLink.Description = 'Start local Gobbler, calendar checks and verified daily backups at Windows sign-in'
$gobblerLink.Save()
Write-Output 'Gobbler will start quietly at Windows sign-in. Backups are restricted to this Windows user and SYSTEM.'
