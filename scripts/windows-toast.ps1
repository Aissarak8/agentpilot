param([Parameter(Mandatory=$true)][string]$TitleBase64,[Parameter(Mandatory=$true)][string]$MessageBase64)
$ErrorActionPreference='Stop'
[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
$title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TitleBase64));$message=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($MessageBase64))
$xml=New-Object Windows.Data.Xml.Dom.XmlDocument;$safeTitle=[Security.SecurityElement]::Escape($title);$safeMessage=[Security.SecurityElement]::Escape($message)
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$safeTitle</text><text>$safeMessage</text></binding></visual></toast>")
$toast=[Windows.UI.Notifications.ToastNotification]::new($xml);[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Visual Studio Code').Show($toast)
