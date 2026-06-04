# feishu-claude-bot 开机自启安装脚本
# 以管理员身份运行此脚本

$taskName = "feishu-claude-bot"
$botDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = "pythonw.exe"

# 查找 pythonw.exe
$pythonPath = Get-Command pythonw.exe -ErrorAction SilentlyContinue
if (-not $pythonPath) {
    Write-Error "未找到 pythonw.exe，请确认 Python 已安装并加入 PATH"
    exit 1
}

Write-Host "Python: $($pythonPath.Source)"
Write-Host "BotDir: $botDir"

$action = New-ScheduledTaskAction `
    -Execute $pythonPath.Source `
    -Argument "main.py" `
    -WorkingDirectory $botDir

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

# 注册任务（覆盖已有）
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force

# 立即启动
Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "========================================"
Write-Host " 安装完成！feishu-claude-bot 已启动"
Write-Host " 下次开机将自动运行（后台无窗口）"
Write-Host "========================================"
Write-Host ""
Write-Host "管理命令："
Write-Host "  状态: Get-ScheduledTask -TaskName '$taskName'"
Write-Host "  停止: Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "  启动: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  卸载: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
