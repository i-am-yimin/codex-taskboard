//! Launch inside the installed MSIX context, then acquire the actual child object.
use crate::{
    owned_process::{inspect, OwnedProcess, ProcessIdentity},
    private_pipe::Pipe,
};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    os::windows::{
        ffi::OsStrExt,
        io::{AsHandle, AsRawHandle},
        process::CommandExt,
    },
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const HELPER: &str = "--taskboard-package-helper";
const FAMILY: &str = "OpenAI.Codex_2p2nqsd0c76g0";

pub struct LaunchRequest {
    pub executable: PathBuf,
    pub package: String,
    pub profile: PathBuf,
    pub codex_home: PathBuf,
    pub marker: PathBuf,
    pub port: u16,
}

pub fn launch(request: LaunchRequest) -> Result<OwnedProcess, String> {
    validate_request(&request)?;
    let own = inspect(unsafe { GetCurrentProcess() })?;
    let session: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();
    let pipe = Pipe::create(&session)?;
    let pending = json!({"state": "pending", "launch": session, "launcherPid": own.pid,
        "launcherTicks": own.created_ticks.to_string()});
    write_new(&request.marker, &pending)?;
    let arguments = format!("{HELPER} {session} {} {}", own.pid, own.created_ticks);
    let script = format!(
        "$ErrorActionPreference='Stop'; Invoke-CommandInDesktopPackage -PackageFamilyName '{}' -AppId App -Command '{}' -Args '{}' -PreventBreakaway",
        FAMILY, own.executable.to_string_lossy().replace('\'', "''"), arguments);
    let powershell = powershell()?;
    // No shell window; the Codex child is the only intended visible window.
    let mut invocation = Command::new(powershell)
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &script,
        ])
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动包上下文辅助入口失败，启动记录保留：{e}"))?;
    // Reap the short PowerShell invocation without waiting for Codex to exit.
    std::thread::spawn(move || {
        let _ = invocation.wait();
    });
    pipe.accept()?;
    let (helper, identity) = pipe.peer(true)?;
    validate_helper(&identity, &own.executable, &request.package)?;
    let hello = pipe.receive()?;
    if hello != json!({"hello": session}) {
        return Err("辅助入口握手与本次启动不符".into());
    }
    pipe.send(&json!({"launch": session, "executable": request.executable,
        "package": request.package, "profile": request.profile, "codexHome": request.codex_home,
        "marker": request.marker, "port": request.port}))?;
    let reply = pipe.receive()?;
    if reply["launch"] != session {
        return Err("辅助入口回执与本次启动不符".into());
    }
    if let Some(error) = reply["error"].as_str() {
        return Err(format!("包上下文启动失败：{error}"));
    }
    let expected = ProcessIdentity {
        pid: reply["pid"]
            .as_u64()
            .and_then(|v| u32::try_from(v).ok())
            .filter(|v| *v != 0)
            .ok_or("辅助回执 PID 无效")?,
        created_ticks: number_string(&reply, "createdTicks")?,
        executable: request.executable.clone(),
        package: Some(request.package.clone()),
    };
    let remote =
        usize::try_from(number_string(&reply, "handle")?).map_err(|_| "辅助回执句柄溢出")?;
    let owned = OwnedProcess::receive(helper.as_handle(), remote, &expected)?;
    let active = read_marker(&request.marker)?;
    if active["launch"] != session
        || active["pid"] != expected.pid
        || active["createdTicks"] != expected.created_ticks.to_string()
        || active["state"] != "active"
    {
        return Err("进程交接与持久启动记录不一致".into());
    }
    pipe.send(&json!({"accepted": session}))?;
    Ok(owned)
}

/// Must run before Tauri single-instance initialization. Malformed helper
/// invocations never fall through into the normal app or create a child.
pub fn dispatch_helper() -> Option<i32> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if !args.first().is_some_and(|arg| arg == HELPER) {
        return None;
    }
    let result = (|| {
        if args.len() != 4 {
            return Err("辅助入口参数无效".to_string());
        }
        let session = args[1].to_str().ok_or("辅助入口名称编码无效")?;
        let parent_pid = args[2]
            .to_str()
            .and_then(|v| v.parse::<u32>().ok())
            .ok_or("主进程标识无效")?;
        let parent_ticks = args[3]
            .to_str()
            .and_then(|v| v.parse::<u64>().ok())
            .ok_or("主进程创建时间无效")?;
        let pipe = Pipe::connect(session)?;
        let (_parent, parent) = pipe.peer(false)?;
        let own = inspect(unsafe { GetCurrentProcess() })?;
        if parent.pid != parent_pid
            || parent.created_ticks != parent_ticks
            || parent.executable != own.executable
        {
            return Err("辅助入口未连接到原启动器".into());
        }
        let package = own
            .package
            .as_deref()
            .filter(|value| {
                value.starts_with("OpenAI.Codex_") && value.ends_with("_x64__2p2nqsd0c76g0")
            })
            .ok_or("辅助入口不在 Codex 安装包上下文")?;
        pipe.send(&json!({"hello": session}))?;
        let config = pipe.receive()?;
        let result = launch_child(&pipe, &config, session, package, &parent);
        if let Err(ref error) = result {
            let _ = pipe.send(&json!({"launch": session, "error": error}));
        }
        result
    })();
    if let Err(error) = result {
        eprintln!("{error}");
        return Some(1);
    }
    Some(0)
}

fn launch_child(
    pipe: &Pipe,
    config: &Value,
    session: &str,
    package: &str,
    parent: &ProcessIdentity,
) -> Result<(), String> {
    if config["launch"] != session || config["package"] != package {
        return Err("启动配置会话或包身份不符".into());
    }
    let request = LaunchRequest {
        executable: path_value(config, "executable")?,
        package: package.into(),
        profile: path_value(config, "profile")?,
        codex_home: path_value(config, "codexHome")?,
        marker: path_value(config, "marker")?,
        port: config["port"]
            .as_u64()
            .and_then(|v| u16::try_from(v).ok())
            .filter(|v| *v != 0)
            .ok_or("隔离端口无效")?,
    };
    validate_request(&request)?;
    let pending = read_marker(&request.marker)?;
    if pending
        != json!({"state": "pending", "launch": session, "launcherPid": parent.pid,
        "launcherTicks": parent.created_ticks.to_string()})
    {
        return Err("启动预留记录不符".into());
    }
    if fs::read_dir(&request.profile)
        .map_err(|e| e.to_string())?
        .next()
        .is_some()
        || fs::read_dir(&request.codex_home)
            .map_err(|e| e.to_string())?
            .next()
            .is_some()
    {
        return Err("隔离目录不是空目录，已拒绝复用".into());
    }
    let mut command = Command::new(&request.executable);
    for (key, _) in std::env::vars_os() {
        let upper = key.to_string_lossy().to_ascii_uppercase();
        if upper.starts_with("CODEX_")
            || upper.starts_with("ELECTRON_")
            || upper.starts_with("TASKBOARD_")
            || upper == "NODE_OPTIONS"
        {
            command.env_remove(key);
        }
    }
    let mut child = command
        .arg(format!("--user-data-dir={}", request.profile.display()))
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--remote-debugging-port={}", request.port))
        .current_dir(request.profile.parent().ok_or("隔离目录缺少父目录")?)
        .env("CODEX_ELECTRON_USER_DATA_PATH", &request.profile)
        .env("CODEX_HOME", &request.codex_home)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("创建隔离 Codex 失败：{e}"))?;
    // From this point, never terminate on a failed handoff: even early windows
    // might already contain a user's draft. Pending/active markers block retry.
    let result = (|| {
        let owned = OwnedProcess::from_child(&child, &request.executable)?;
        let identity = owned.identity();
        if identity.package.as_deref() != Some(package) {
            return Err("Codex 子进程包身份不符".into());
        }
        let active = json!({"state": "active", "launch": session, "pid": identity.pid,
            "createdTicks": identity.created_ticks.to_string()});
        replace_pending(&request.marker, &pending, &active, session)?;
        pipe.send(&json!({"launch": session, "pid": identity.pid,
            "createdTicks": identity.created_ticks.to_string(), "handle": (child.as_raw_handle() as usize).to_string()}))?;
        if pipe.receive()? != json!({"accepted": session}) {
            return Err("启动器交接确认无效".into());
        }
        Ok(())
    })();
    // Report failure while retaining the child; wait also keeps its source handle
    // valid until the main process has finished duplication or timed out.
    if let Err(ref error) = result {
        let _ = pipe.send(&json!({"launch": session, "error": error}));
    }
    let _ = child.wait();
    result
}

fn validate_helper(
    identity: &ProcessIdentity,
    executable: &Path,
    package: &str,
) -> Result<(), String> {
    if identity.executable != executable || identity.package.as_deref() != Some(package) {
        return Err("命名管道通信方不是预期包上下文的 Taskboard 辅助入口".into());
    }
    Ok(())
}

fn validate_request(request: &LaunchRequest) -> Result<(), String> {
    let exe = fs::canonicalize(&request.executable).map_err(|e| e.to_string())?;
    if exe != request.executable
        || exe.file_name().and_then(|v| v.to_str()) != Some("ChatGPT.exe")
        || exe
            .parent()
            .and_then(Path::file_name)
            .and_then(|v| v.to_str())
            != Some("app")
        || exe
            .parent()
            .and_then(Path::parent)
            .and_then(Path::file_name)
            .and_then(|v| v.to_str())
            != Some(request.package.as_str())
        || !request.package.starts_with("OpenAI.Codex_")
        || !request.package.ends_with("_x64__2p2nqsd0c76g0")
    {
        return Err("隔离启动可执行路径与包身份不符".into());
    }
    let profile = fs::canonicalize(&request.profile).map_err(|e| e.to_string())?;
    let home = fs::canonicalize(&request.codex_home).map_err(|e| e.to_string())?;
    let marker_parent = request.marker.parent().ok_or("启动记录目录无效")?;
    if profile != request.profile
        || home != request.codex_home
        || profile.file_name().and_then(|v| v.to_str()) != Some("profile")
        || home.file_name().and_then(|v| v.to_str()) != Some("codex-home")
        || profile.parent() != home.parent()
        || profile.parent().and_then(Path::parent) != Some(marker_parent)
        || fs::canonicalize(marker_parent).map_err(|e| e.to_string())? != marker_parent
        || request.marker.file_name().and_then(|v| v.to_str()) != Some("active.json")
        || request.port == 0
    {
        return Err("隔离目录与启动记录边界不符".into());
    }
    Ok(())
}

fn read_marker(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > 4096 {
        return Err("启动记录过大".into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "启动记录损坏".into())
}
fn write_new(path: &Path, value: &Value) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(value.to_string().as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}
fn replace_pending(
    path: &Path,
    pending: &Value,
    active: &Value,
    session: &str,
) -> Result<(), String> {
    if &read_marker(path)? != pending {
        return Err("启动预留记录发生变化".into());
    }
    let staging = path.with_file_name(format!("active-{session}.tmp"));
    write_new(&staging, active)?;
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    if unsafe { MoveFileExW(wide(&staging).as_ptr(), wide(path).as_ptr(), 1 | 8) } == 0 {
        return Err(format!(
            "持久化进程身份失败，预留记录保留：{}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}
fn path_value(value: &Value, key: &str) -> Result<PathBuf, String> {
    value[key]
        .as_str()
        .map(PathBuf::from)
        .ok_or_else(|| format!("启动路径字段无效：{key}"))
}
fn number_string(value: &Value, key: &str) -> Result<u64, String> {
    value[key]
        .as_str()
        .and_then(|v| v.parse().ok())
        .filter(|v| *v != 0)
        .ok_or_else(|| format!("启动数值字段无效：{key}"))
}
fn powershell() -> Result<PathBuf, String> {
    let root = std::env::var_os("SystemRoot").ok_or("缺少 Windows 系统目录")?;
    Ok(Path::new(&root).join("System32/WindowsPowerShell/v1.0/powershell.exe"))
}
#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentProcess() -> *mut std::ffi::c_void;
    fn MoveFileExW(old: *const u16, new: *const u16, flags: u32) -> i32;
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pending_marker_is_exclusive_and_identity_is_committed_atomically() {
        let root = std::env::temp_dir().join(format!("taskboard-marker-{}", rand::random::<u64>()));
        fs::create_dir(&root).unwrap();
        let marker = root.join("active.json");
        let pending = json!({"state": "pending", "launch": "test"});
        let active = json!({"state": "active", "pid": 123, "createdTicks": "456"});
        write_new(&marker, &pending).unwrap();
        assert!(write_new(&marker, &pending).is_err());
        assert!(replace_pending(&marker, &json!({}), &active, "wrong").is_err());
        assert_eq!(read_marker(&marker).unwrap(), pending);
        let collision = marker.with_file_name("active-blocked.tmp");
        fs::write(&collision, b"existing staging file").unwrap();
        assert!(replace_pending(&marker, &pending, &active, "blocked").is_err());
        assert_eq!(read_marker(&marker).unwrap(), pending);
        fs::remove_file(collision).unwrap();
        replace_pending(&marker, &pending, &active, "test").unwrap();
        assert_eq!(read_marker(&marker).unwrap(), active);
        assert!(replace_pending(&marker, &pending, &active, "duplicate").is_err());
        fs::remove_file(marker).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn helper_identity_requires_exact_executable_and_package() {
        let mut identity = ProcessIdentity {
            pid: 1,
            created_ticks: 2,
            executable: PathBuf::from("C:/Taskboard.exe"),
            package: Some("expected".into()),
        };
        assert!(validate_helper(&identity, &identity.executable, "expected").is_ok());
        assert!(validate_helper(&identity, Path::new("C:/other.exe"), "expected").is_err());
        identity.package = None;
        assert!(validate_helper(&identity, &identity.executable, "expected").is_err());
    }
}
