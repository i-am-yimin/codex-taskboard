//! Connect to the user's normal MSIX Codex without selecting a new profile.
//! Discovery never trusts a renderer PID or an arbitrary debugging endpoint.
use crate::{managed_codex::{self, ManagedCodex}, owned_process::OwnedProcess};
use serde_json::{json, Value};
use std::{
    fs, io::Read, net::TcpListener, os::windows::process::CommandExt,
    path::{Path, PathBuf}, process::{Command, Stdio}, thread,
    time::{Duration, Instant},
};

const FAMILY: &str = "OpenAI.Codex_2p2nqsd0c76g0";
const RESTART: &str = "日常 Codex 已打开，但尚未启用连接。请先保存工作并正常退出 Codex，再点击“接入日常 Codex”；将沿用原登录、项目和会话。以后可使用“Codex（任务看板连接）”快捷方式启动。";

#[derive(Debug)]
struct Installation { version: String, executable: PathBuf, package: String, pids: Vec<u32> }

fn powershell() -> Result<Command, String> {
    let root = std::env::var_os("SystemRoot").ok_or("缺少 Windows 系统目录")?;
    let mut command = Command::new(Path::new(&root).join("System32/WindowsPowerShell/v1.0/powershell.exe"));
    command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"])
        .creation_flags(0x08000000).stdin(Stdio::null());
    Ok(command)
}

fn run_script(script: &str) -> Result<String, String> {
    let mut child = powershell()?.arg(script).stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn().map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(30);
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? { break status; }
        if Instant::now() >= deadline {
            let _ = child.kill(); let _ = child.wait();
            return Err("读取 Codex 安装信息超时，请稍后重试".into());
        }
        thread::sleep(Duration::from_millis(50));
    };
    if !status.success() { return Err("无法读取当前用户的 Codex 安装或进程信息".into()); }
    let mut output = String::new();
    child.stdout.take().ok_or("缺少本机检查输出")?.take(16 * 1024).read_to_string(&mut output)
        .map_err(|e| e.to_string())?;
    Ok(output)
}

fn discover() -> Result<Installation, String> {
    // Only small metadata leaves PowerShell; no command lines, conversations,
    // credentials or account files are returned to the renderer.
    let output = run_script(r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $packages=@(Get-AppxPackage -Name OpenAI.Codex | Where-Object { $_.PublisherId -eq '2p2nqsd0c76g0' }); if ($packages.Count -ne 1) { throw 'Codex package must be unique' }; $package=$packages[0]; $processes=@(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $package.InstallLocation 'app\ChatGPT.exe') -and $_.CommandLine -and $_.CommandLine -notmatch '--type=' }); $pids=@($processes | Where-Object { $_.CommandLine -notmatch '--user-data-dir(?:=| )' } | ForEach-Object { [uint32]$_.ProcessId }); @{version=[string]$package.Version; package=[string]$package.PackageFullName; executable=(Join-Path $package.InstallLocation 'app\ChatGPT.exe'); pids=$pids; customProfileOnly=($processes.Count -gt 0 -and $pids.Count -eq 0)} | ConvertTo-Json -Compress"#)?;
    parse_installation(&output)
}

fn parse_installation(output: &str) -> Result<Installation, String> {
    let value: Value = serde_json::from_str(output.trim_start_matches('\u{feff}'))
        .map_err(|_| "Codex 安装信息格式无效")?;
    let version = value["version"].as_str().ok_or("缺少 Codex 版本")?;
    let parts: Vec<_> = version.split('.').collect();
    if parts.len() != 4 || parts.iter().any(|part| part.is_empty()
        || !part.bytes().all(|b| b.is_ascii_digit()) || part.parse::<u16>().is_err()) {
        return Err("Codex 安装版本无效".into());
    }
    let package = value["package"].as_str().ok_or("缺少 Codex 安装包身份")?;
    if package != format!("OpenAI.Codex_{version}_x64__2p2nqsd0c76g0") {
        return Err("Codex 安装包身份不符".into());
    }
    let executable = fs::canonicalize(value["executable"].as_str().ok_or("缺少 Codex 路径")?)
        .map_err(|e| e.to_string())?;
    if executable.file_name().and_then(|v| v.to_str()) != Some("ChatGPT.exe")
        || executable.parent().and_then(Path::file_name).and_then(|v| v.to_str()) != Some("app")
        || executable.parent().and_then(Path::parent).and_then(Path::file_name).and_then(|v| v.to_str()) != Some(package) {
        return Err("Codex 安装路径与包身份不符".into());
    }
    let pids = value["pids"].as_array().ok_or("缺少 Codex 进程列表")?.iter().map(|pid|
        pid.as_u64().and_then(|v| u32::try_from(v).ok()).filter(|v| *v != 0)
            .ok_or_else(|| "Codex 进程列表无效".to_string())).collect::<Result<Vec<_>, _>>()?;
    if pids.len() > 1 { return Err("发现多个日常 Codex 主进程，请先正常退出多余窗口后重试".into()); }
    if value["customProfileOnly"] == true {
        return Err("检测到自定义目录或独立测试 Codex；请先正常退出该窗口，再从日常接入入口打开，避免连接到错误环境。".into());
    }
    Ok(Installation { version: version.into(), executable, package: package.into(), pids })
}

fn attach(installation: &Installation, pid: u32) -> Result<Option<ManagedCodex>, String> {
    let process = OwnedProcess::attach_existing(pid, &installation.executable, &installation.package)?;
    let ports: Vec<_> = managed_codex::loopback_listeners()?.into_iter()
        .filter(|(_, owner)| *owner == pid).map(|(port, _)| port).collect();
    if ports.len() > 16 { return Err("Codex 的回环监听端口过多，无法唯一确认连接".into()); }
    let mut targets = Vec::new();
    for port in ports {
        if let Ok(target) = managed_codex::fetch_target(port) { targets.push((port, target)); }
    }
    if targets.is_empty() { return Ok(None); }
    if targets.len() != 1 { return Err("Codex 调试页面不唯一，已停止接入".into()); }
    let (port, target) = targets.remove(0);
    let session = ManagedCodex::from_daily(process, installation.version.clone(), port, target);
    if !session.verify() { return Err("日常 Codex 的进程、端口或页面在连接时发生变化".into()); }
    Ok(Some(session))
}

pub fn status() -> Result<Value, String> {
    let installation = discover()?;
    let (state, reason) = if let Some(pid) = installation.pids.first() {
        if attach(&installation, *pid)?.is_some() {
            ("connectable", "检测到日常 Codex 的连接端口；接入时还会检查侧栏版本兼容性。")
        } else { ("restart-required", RESTART) }
    } else { ("not-running", "接入时将打开日常 Codex，沿用原登录、项目和会话。") };
    Ok(json!({"state": state, "reason": reason, "version": installation.version}))
}

pub fn connect() -> Result<ManagedCodex, String> {
    let installation = discover()?;
    if let Some(pid) = installation.pids.first() {
        return attach(&installation, *pid)?.ok_or_else(|| RESTART.into());
    }
    let reservation = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = reservation.local_addr().map_err(|e| e.to_string())?.port();
    drop(reservation);
    // The normal package entry uses its normal profile. Do not pass a data-dir
    // flag, copy login state, or set CODEX_HOME to an isolated directory.
    let script = format!(
        "$ErrorActionPreference='Stop'; Invoke-CommandInDesktopPackage -PackageFamilyName '{FAMILY}' -AppId App -Command '{}' -Args '--remote-debugging-address=127.0.0.1 --remote-debugging-port={port}' -PreventBreakaway",
        installation.executable.to_string_lossy().replace('\'', "''"));
    let mut command = powershell()?;
    // A task launched from Codex must not pass its per-chat/isolated context on
    // to the normal desktop. Preserve explicit user/machine Codex settings.
    for (key, _) in std::env::vars_os() {
        let upper = key.to_string_lossy().to_ascii_uppercase();
        if upper.starts_with("CODEX_") || upper.starts_with("ELECTRON_")
            || upper.starts_with("TASKBOARD_") || upper == "NODE_OPTIONS" { command.env_remove(key); }
    }
    let script = format!(r#"foreach ($scope in @('Machine','User')) {{ $vars=[Environment]::GetEnvironmentVariables($scope); foreach ($key in $vars.Keys) {{ if ([string]$key -like 'CODEX_*') {{ [Environment]::SetEnvironmentVariable($key,$vars[$key],'Process') }} }} }}; {script}"#);
    let mut invocation = command.arg(script).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().map_err(|e| format!("无法打开日常 Codex：{e}"))?;
    thread::spawn(move || { let _ = invocation.wait(); });
    let deadline = Instant::now() + Duration::from_secs(90);
    while Instant::now() < deadline {
        if let Some(pid) = managed_codex::listener_owner(port)? {
            if let Some(session) = attach(&installation, pid)? { return Ok(session); }
        }
        thread::sleep(Duration::from_millis(200));
    }
    Err("日常 Codex 已请求打开，但连接尚未就绪。请检查窗口；不要重复启动，稍后再检测连接。".into())
}

pub fn create_shortcut(executable: &Path) -> Result<String, String> {
    let target = executable.to_string_lossy().replace('\'', "''");
    run_script(&format!(r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $path=Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex（任务看板连接）.lnk'; if (Test-Path -LiteralPath $path) {{ $old=(New-Object -ComObject WScript.Shell).CreateShortcut($path); if ($old.TargetPath -ne '{target}' -or $old.Arguments -ne '--connect-daily-codex') {{ throw 'Existing shortcut belongs to another application' }} }}; $link=(New-Object -ComObject WScript.Shell).CreateShortcut($path); $link.TargetPath='{target}'; $link.Arguments='--connect-daily-codex'; $link.Description='打开日常 Codex 并连接任务看板，沿用原登录和项目'; $link.Save(); Write-Output 'ok'"#))?;
    Ok("已创建开始菜单入口“Codex（任务看板连接）”；以后用它打开日常 Codex，无需独立环境。".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_exact_package_metadata_and_rejects_multiple_main_processes() {
        let root = std::env::temp_dir().join(format!("daily-codex-test-{}", rand::random::<u64>()));
        let package = "OpenAI.Codex_26.1.2.3_x64__2p2nqsd0c76g0";
        let directory = root.join(package).join("app");
        fs::create_dir_all(&directory).unwrap();
        let executable = directory.join("ChatGPT.exe");
        fs::write(&executable, b"metadata-fixture-not-executable").unwrap();
        let mut value = json!({"version":"26.1.2.3", "package":package, "executable":executable, "pids":[1234]});
        let installation = parse_installation(&value.to_string()).unwrap();
        assert_eq!(installation.pids, vec![1234]);
        assert_eq!(installation.version, "26.1.2.3");
        // A package-shaped path is not process authentication.
        assert!(OwnedProcess::attach_existing(std::process::id(), &executable, package).is_err());
        value["pids"] = json!([1234, 5678]);
        assert!(parse_installation(&value.to_string()).unwrap_err().contains("多个"));
        value["pids"] = json!([0]);
        assert!(parse_installation(&value.to_string()).is_err());
        value["pids"] = json!([]);
        value["customProfileOnly"] = json!(true);
        assert!(parse_installation(&value.to_string()).unwrap_err().contains("错误环境"));
        fs::remove_file(executable).unwrap();
        fs::remove_dir(directory).unwrap();
        fs::remove_dir(root.join(package)).unwrap();
        fs::remove_dir(root).unwrap();
    }

    #[test]
    fn rejects_untrusted_installation_metadata() {
        for value in [json!({}), json!({"version":"26.1.2", "package":"x"}),
            json!({"version":"26.1.2.3", "package":"OpenAI.Codex_26.1.2.3_x64__wrong"})] {
            assert!(parse_installation(&value.to_string()).is_err());
        }
    }
}
