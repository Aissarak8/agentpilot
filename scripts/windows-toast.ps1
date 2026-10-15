param([Parameter(Mandatory=$true)][string]$TitleBase64,[Parameter(Mandatory=$true)][string]$MessageBase64,[string]$AppId='Microsoft.VisualStudioCode')
$ErrorActionPreference='Stop'
try {
  $stage='permissions'
  $globalSettings=Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications' -ErrorAction SilentlyContinue
  $global=$globalSettings.ToastEnabled
  if($global -eq 0){throw [InvalidOperationException]::new('notifications_disabled_global')}
  $appPath="HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\$AppId"
  $appSettings=Get-ItemProperty -LiteralPath $appPath -ErrorAction SilentlyContinue
  $enabled=$appSettings.Enabled
  if($enabled -eq 0){throw [InvalidOperationException]::new('notifications_disabled_app')}
  $registered=@(Get-StartApps | Where-Object {$_.AppID -eq $AppId}).Count -gt 0
  if(-not $registered){throw [InvalidOperationException]::new('identity_missing')}
  $stage='process_identity'
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class AgentPilotAppIdentity {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
}
'@
  $identityResult=[AgentPilotAppIdentity]::SetCurrentProcessExplicitAppUserModelID($AppId)
  if($identityResult -ne 0){throw [ComponentModel.Win32Exception]::new($identityResult)}
  $stage='runtime_types'
  [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime] | Out-Null
  [Windows.UI.Notifications.ToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
  [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
  $stage='decode'
  $title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TitleBase64));$message=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($MessageBase64))
  $stage='xml'
  $xml=New-Object Windows.Data.Xml.Dom.XmlDocument;$safeTitle=[Security.SecurityElement]::Escape($title);$safeMessage=[Security.SecurityElement]::Escape($message)
  $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$safeTitle</text><text>$safeMessage</text></binding></visual></toast>")
  $stage='show'
  $toast=[Windows.UI.Notifications.ToastNotification]::new($xml);[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)
} catch {
  $root=$_.Exception
  while($root.InnerException){$root=$root.InnerException}
  $category=switch($_.Exception.Message){'notifications_disabled_global'{'notifications_disabled_global'}'notifications_disabled_app'{'notifications_disabled_app'}'identity_missing'{'identity_missing'}default{if($root.HResult -eq -2147024891){'identity_denied'}else{'powershell_failed'}}}
  if($category -eq 'identity_denied'){
    try {
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $fallback=New-Object System.Windows.Forms.NotifyIcon
      $fallback.Icon=[System.Drawing.SystemIcons]::Information
      $fallback.Visible=$true
      $fallback.BalloonTipTitle=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TitleBase64))
      $fallback.BalloonTipText=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($MessageBase64))
      $fallback.BalloonTipIcon=[System.Windows.Forms.ToolTipIcon]::Info
      $fallback.ShowBalloonTip(5000)
      Start-Sleep -Seconds 6
      $fallback.Dispose()
      [Console]::Error.WriteLine('AGENTPILOT_SUCCESS category=balloon_fallback')
      exit 0
    } catch {}
  }
  $hresult=('0x{0:X8}' -f ($root.HResult -band 0xffffffffL))
  [Console]::Error.WriteLine("AGENTPILOT_ERROR category=$category stage=$stage hresult=$hresult")
  exit 1
}
