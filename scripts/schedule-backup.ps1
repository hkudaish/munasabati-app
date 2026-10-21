<#
  Registers (or removes) a Windows scheduled task that runs automatic incremental backups.

    powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -Target production            # every hour
    powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -Target local -EveryMinutes 30
    powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1 -Target production -Remove

  The task runs `node scripts\backup.cjs auto --target <Target>` from this repository, as YOU, only while you are
  signed in to Windows (no password is stored). It runs a missed backup as soon as possible, never two at once,
  and needs the network. `auto` takes a full backup first, then incrementals, a new full backup every 7 days, checks
  its own result and prunes old chains. Failures are written to backup.log in the backup folder and show up as a
  non-zero "Last Run Result" in Task Scheduler.

  Put BACKUP_ENCRYPTION_KEY in .env (node scripts\backup.cjs keygen) so the files are encrypted.
#>
param(
  [ValidateSet('local', 'production')] [string] $Target = 'production',
  [int] $EveryMinutes = 60,
  [switch] $Remove
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$name = "Munasabati incremental backup ($Target)"

if ($Remove) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "Removed scheduled task: $name"
  } else { Write-Host "No scheduled task named: $name" }
  return
}

$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "scripts\backup.cjs auto --target $Target" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Incremental database backup ($Target) for Munasabati. See docs/BACKUP.md." -Force | Out-Null
Write-Host "Scheduled: $name  (every $EveryMinutes minutes, first run in about a minute)"
Write-Host "Check it with:  node scripts\backup.cjs list --target $Target"
