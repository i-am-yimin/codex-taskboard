//! Native ownership checks for a Codex process created by this launcher.
//! The renderer never supplies a PID, executable, profile, or CDP target.

use crate::owned_process::OwnedProcess;
use rand::{distributions::Alphanumeric, Rng};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

// Host/draft acceptance and native package-context handle transfer verified.
// The package-context launcher can inspect this version in an isolated profile.
// The companion has a separate host-DOM allowlist for injection and drafts.
const LAUNCHABLE_VERSION: &str = "26.924.2738.0";
const CODEX_PAGE: &str = "app://-/index.html";
const START_TIMEOUT: Duration = Duration::from_secs(90);
const CDP_TIMEOUT: Duration = Duration::from_millis(1200);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TargetBinding {
    pub id: String,
    pub page_url: String,
    pub websocket_url: String,
}

pub struct ManagedCodex {
    child: OwnedProcess,
    created_ticks: u64,
    session_id: String,
    pub profile: PathBuf,
    pub codex_home: PathBuf,
    pub port: u16,
    pub target: Option<TargetBinding>,
}

impl ManagedCodex {
    pub fn pid(&self) -> u32 {
        self.child.identity().pid
    }

    fn session_description(&self) -> Value {
        let target = self.target.as_ref().expect("verified Codex target");
        serde_json::json!({
            "id": self.session_id,
            "version": LAUNCHABLE_VERSION,
            "pid": self.pid(),
            "createdTicks": self.created_ticks.to_string(),
            "codexHome": self.codex_home,
            "endpoint": format!("http://127.0.0.1:{}", self.port),
            "targetId": target.id,
            "exactPageUrl": target.page_url,
            "pageWebSocketUrl": target.websocket_url,
        })
    }

    pub fn is_running(&mut self) -> bool {
        self.child.is_running()
    }

    /// Verifies the held child handle, its original creation time, the OS TCP
    /// listener owner, and the exact page discovered when it was launched.
    pub fn verify(&mut self) -> bool {
        self.is_running()
            && self.created_ticks != 0
            && self.profile.is_dir()
            && self.codex_home.is_dir()
            && self.child.identity().created_ticks == self.created_ticks
            && self.child.verify()
            && listener_owner(self.port).ok().flatten() == Some(self.pid())
            && self
                .target
                .as_ref()
                .is_some_and(|target| fetch_target(self.port).ok().as_ref() == Some(target))
    }

    pub fn await_binding(&mut self) -> Result<(), String> {
        if self.created_ticks == 0 {
            return Err("无法读取 Codex 子进程创建时间".into());
        }
        let deadline = Instant::now() + START_TIMEOUT;
        loop {
            if !self.is_running() {
                return Err("Codex 子进程在 CDP 就绪前退出".into());
            }
            if listener_owner(self.port).ok().flatten() == Some(self.pid()) {
                if let Ok(target) = fetch_target(self.port) {
                    self.target = Some(target);
                    return Ok(());
                }
            }
            if Instant::now() >= deadline {
                return Err("Codex 子进程的回环 CDP 页面未在 90 秒内完成精确绑定".into());
            }
            thread::sleep(Duration::from_millis(150));
        }
    }
}

pub fn launch(data_directory: &Path) -> Result<ManagedCodex, String> {
    let managed_root = data_directory.join("managed-codex");
    fs::create_dir_all(&managed_root).map_err(|error| error.to_string())?;
    let managed_root = fs::canonicalize(managed_root).map_err(|error| error.to_string())?;
    let marker = managed_root.join("active.json");
    reject_running_previous(&marker)?;
    let executable = discover_launchable_executable()?;
    let launch_id: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect();
    let root = managed_root.join(launch_id);
    fs::create_dir(&root).map_err(|error| error.to_string())?;
    let profile = root.join("profile");
    let codex_home = root.join("codex-home");
    fs::create_dir_all(&profile).map_err(|error| error.to_string())?;
    fs::create_dir_all(&codex_home).map_err(|error| error.to_string())?;
    let reservation = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = reservation
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    drop(reservation);
    let package = executable
        .parent()
        .and_then(Path::parent)
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .ok_or("Codex 安装包目录无效")?
        .to_string();
    let owned = crate::package_launch::launch(crate::package_launch::LaunchRequest {
        executable,
        package,
        profile: profile.clone(),
        codex_home: codex_home.clone(),
        marker,
        port,
    })?;
    let created_ticks = owned.identity().created_ticks;
    Ok(ManagedCodex {
        child: owned,
        created_ticks,
        session_id: rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(48)
            .map(char::from)
            .collect(),
        profile,
        codex_home,
        port,
        target: None,
    })
}

fn reject_running_previous(marker: &Path) -> Result<(), String> {
    if !marker.exists() {
        return Ok(());
    }
    let value: Value =
        serde_json::from_slice(&fs::read(marker).map_err(|error| error.to_string())?)
            .map_err(|_| "独立 Codex 的上次运行记录损坏；请先人工核对该实例".to_string())?;
    if value["state"] == "pending" {
        return Err(
            "上次包上下文启动尚未确认，可能已创建独立窗口；请先核对该实例，已拒绝重复启动".into(),
        );
    }
    let pid = value["pid"]
        .as_u64()
        .and_then(|value| u32::try_from(value).ok())
        .filter(|value| *value != 0)
        .ok_or("独立 Codex 的上次 PID 记录无效；请先人工核对")?;
    let ticks = value["createdTicks"]
        .as_str()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value != 0)
        .ok_or("独立 Codex 的上次创建时间记录无效；请先人工核对")?;
    if let Some((actual, running)) = process_state_by_pid(pid)? {
        if actual == ticks && running {
            return Err(
                "上次独立 Codex 仍在运行，可能含未发送草稿；请在该窗口处理草稿并关闭后重试".into(),
            );
        }
    }
    fs::remove_file(marker).map_err(|error| format!("无法清除已退出 Codex 的运行记录：{error}"))
}

/// A separate random capability is passed only to the companion child process.
/// Each query rechecks the launcher-held handle, TCP owner and exact CDP page.
pub fn start_control(state: Arc<Mutex<Option<ManagedCodex>>>, key: String) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    thread::Builder::new()
        .name("managed-codex-control".into())
        .spawn(move || {
            for incoming in listener.incoming() {
                if let Ok(mut stream) = incoming {
                    let _ = serve_control(&mut stream, &state, &key);
                }
            }
        })
        .map_err(|error| error.to_string())?;
    Ok(port)
}

fn serve_control(
    stream: &mut TcpStream,
    state: &Arc<Mutex<Option<ManagedCodex>>>,
    key: &str,
) -> Result<(), String> {
    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_millis(500)))
        .map_err(|error| error.to_string())?;
    let mut request = Vec::new();
    let mut chunk = [0_u8; 512];
    while request.len() <= 4096 && !request.windows(4).any(|part| part == b"\r\n\r\n") {
        let count = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if count == 0 {
            return Ok(());
        }
        request.extend_from_slice(&chunk[..count]);
    }
    if request.len() > 4096 {
        return Ok(());
    }
    let request = std::str::from_utf8(&request).map_err(|error| error.to_string())?;
    let mut lines = request.split("\r\n");
    let path = lines
        .next()
        .and_then(|line| line.strip_prefix("GET "))
        .and_then(|line| line.strip_suffix(" HTTP/1.1"));
    let authorized = lines.take_while(|line| !line.is_empty()).any(|line| {
        line.split_once(':').is_some_and(|(name, value)| {
            name.eq_ignore_ascii_case("x-taskboard-control-key") && value.trim() == key
        })
    });
    if !authorized || path.is_none() {
        stream
            .write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    let path = path.expect("checked above");
    let mut guard = state.lock().map_err(|_| "Codex ownership lock poisoned")?;
    let session = guard
        .as_mut()
        .and_then(|child| child.verify().then_some(child));
    let body = if path == "/session" {
        serde_json::json!({ "session": session.map(|child| child.session_description()) })
    } else if let Some(id) = path.strip_prefix("/verify/") {
        serde_json::json!({ "valid": session.is_some_and(|child| child.session_id == id) })
    } else {
        serde_json::json!({ "error": "unknown control request" })
    };
    let body = body.to_string();
    let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
    stream
        .write_all(response.as_bytes())
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn discover_launchable_executable() -> Result<PathBuf, String> {
    let script = "Get-AppxPackage -Name OpenAI.Codex | Where-Object { $_.PublisherId -eq '2p2nqsd0c76g0' } | ForEach-Object { '{0}|{1}' -f $_.Version,$_.InstallLocation }";
    let system_root = std::env::var_os("SystemRoot").ok_or("缺少 Windows 系统目录")?;
    let powershell = Path::new(&system_root)
        .join("System32")
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe");
    if !powershell.is_file() {
        return Err("无法找到 Windows PowerShell 安装路径".into());
    }
    let output = Command::new(powershell)
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ])
        .output()
        .map_err(|error| format!("无法查询 Codex 安装包：{error}"))?;
    if !output.status.success() {
        return Err("无法查询 Codex 安装包版本".into());
    }
    let listing = String::from_utf8_lossy(&output.stdout);
    let matches: Vec<PathBuf> = listing
        .lines()
        .filter_map(|line| line.trim().split_once('|'))
        .filter(|(version, _)| *version == LAUNCHABLE_VERSION)
        .map(|(_, location)| Path::new(location.trim()).join("app").join("ChatGPT.exe"))
        .filter(|path| path.is_file())
        .collect();
    if matches.len() != 1 {
        return Err("当前 Codex 安装包版本未列入隔离启动清单".into());
    }
    fs::canonicalize(&matches[0]).map_err(|error| error.to_string())
}

pub(crate) fn fetch_target(port: u16) -> Result<TargetBinding, String> {
    let addr: SocketAddr = format!("127.0.0.1:{port}")
        .parse()
        .map_err(|error| format!("无效的 CDP 地址：{error}"))?;
    let mut stream =
        TcpStream::connect_timeout(&addr, CDP_TIMEOUT).map_err(|error| error.to_string())?;
    stream
        .set_read_timeout(Some(CDP_TIMEOUT))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(CDP_TIMEOUT))
        .map_err(|error| error.to_string())?;
    write!(
        stream,
        "GET /json/list HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    )
    .map_err(|error| error.to_string())?;
    let body = read_cdp_body(&mut stream)?;
    let targets: Value = serde_json::from_slice(&body).map_err(|error| error.to_string())?;
    let targets = targets.as_array().ok_or("Codex CDP 目标列表不是数组")?;
    let matches: Vec<&Value> = targets
        .iter()
        .filter(|item| item["type"] == "page" && item["url"] == CODEX_PAGE)
        .collect();
    if matches.len() != 1 {
        return Err("Codex 主页面目标不唯一".into());
    }
    let id = matches[0]["id"]
        .as_str()
        .ok_or("Codex 主页面缺少 targetId")?;
    if id.len() != 32 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Codex targetId 格式无效".into());
    }
    let expected = format!("ws://127.0.0.1:{port}/devtools/page/{id}");
    if matches[0]["webSocketDebuggerUrl"].as_str() != Some(expected.as_str()) {
        return Err("Codex 页面 WebSocket 与回环目标不匹配".into());
    }
    Ok(TargetBinding {
        id: id.into(),
        page_url: CODEX_PAGE.into(),
        websocket_url: expected,
    })
}

fn read_cdp_body(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    const MAX_HEADER: usize = 16 * 1024;
    const MAX_BODY: usize = 1024 * 1024;
    let deadline = Instant::now() + CDP_TIMEOUT;
    let mut response = Vec::new();
    let mut framing: Option<(usize, usize)> = None;
    loop {
        if let Some((body_start, body_len)) = framing {
            if response.len() >= body_start + body_len {
                if response.len() != body_start + body_len {
                    return Err("Codex CDP 目标列表正文长度不一致".into());
                }
                return Ok(response[body_start..].to_vec());
            }
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("Codex CDP 目标列表读取超时".into());
        }
        stream
            .set_read_timeout(Some(remaining))
            .map_err(|error| error.to_string())?;
        let mut chunk = [0_u8; 8192];
        let count = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if count == 0 {
            return Err("Codex CDP 目标列表提前结束".into());
        }
        response.extend_from_slice(&chunk[..count]);
        if response.len() > MAX_HEADER + MAX_BODY {
            return Err("Codex CDP 目标列表响应过大".into());
        }
        if framing.is_none() {
            if let Some(header_end) = response.windows(4).position(|part| part == b"\r\n\r\n") {
                if header_end > MAX_HEADER {
                    return Err("Codex CDP 目标列表响应头过大".into());
                }
                let header = std::str::from_utf8(&response[..header_end])
                    .map_err(|error| error.to_string())?;
                if !header.starts_with("HTTP/1.1 200 ") {
                    return Err("Codex CDP 目标列表响应无效".into());
                }
                let lengths: Vec<usize> = header
                    .split("\r\n")
                    .filter_map(|line| line.split_once(':'))
                    .filter(|(name, _)| name.eq_ignore_ascii_case("content-length"))
                    .map(|(_, value)| value.trim().parse::<usize>())
                    .collect::<Result<_, _>>()
                    .map_err(|error| error.to_string())?;
                if lengths.len() != 1 || lengths[0] > MAX_BODY {
                    return Err("Codex CDP 目标列表正文长度无效".into());
                }
                framing = Some((header_end + 4, lengths[0]));
            } else if response.len() > MAX_HEADER {
                return Err("Codex CDP 目标列表响应头过大".into());
            }
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
struct FileTime {
    low: u32,
    high: u32,
}

#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    fn GetLastError() -> u32;
    fn WaitForSingleObject(handle: *mut std::ffi::c_void, timeout: u32) -> u32;
    fn GetProcessTimes(
        process: *mut std::ffi::c_void,
        created: *mut FileTime,
        exited: *mut FileTime,
        kernel: *mut FileTime,
        user: *mut FileTime,
    ) -> i32;
}

fn process_state_by_pid(pid: u32) -> Result<Option<(u64, bool)>, String> {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const SYNCHRONIZE: u32 = 0x0010_0000;
    const ERROR_INVALID_PARAMETER: u32 = 87;
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, 0, pid) };
    if handle.is_null() {
        let error = unsafe { GetLastError() };
        return if error == ERROR_INVALID_PARAMETER {
            Ok(None)
        } else {
            Err(format!("无法核对上次独立 Codex 进程：Windows 错误 {error}"))
        };
    }
    let blank = FileTime { low: 0, high: 0 };
    let (mut created, mut exited, mut kernel, mut user) = (blank, blank, blank, blank);
    let times =
        unsafe { GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) };
    let status = unsafe { WaitForSingleObject(handle, 0) };
    unsafe {
        CloseHandle(handle);
    }
    if times == 0 || !matches!(status, 0 | 258) {
        return Err("无法核对上次独立 Codex 进程状态".into());
    }
    Ok(Some((
        (u64::from(created.high) << 32) | u64::from(created.low),
        status == 258,
    )))
}

#[repr(C)]
#[derive(Clone, Copy)]
struct TcpRowOwnerPid {
    state: u32,
    local_addr: u32,
    local_port: u32,
    remote_addr: u32,
    remote_port: u32,
    owning_pid: u32,
}

#[link(name = "iphlpapi")]
extern "system" {
    fn GetExtendedTcpTable(
        table: *mut std::ffi::c_void,
        size: *mut u32,
        order: i32,
        family: u32,
        table_class: u32,
        reserved: u32,
    ) -> u32;
}

/// Reads the Windows TCP owner table directly so verification stays within the
/// adapter's three-second budget; a process listing or open port alone is not proof.
pub fn listener_owner(port: u16) -> Result<Option<u32>, String> {
    const AF_INET: u32 = 2;
    const TCP_TABLE_OWNER_PID_LISTENER: u32 = 3;
    const LISTEN: u32 = 2;
    let mut size = 0_u32;
    unsafe {
        GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size,
            0,
            AF_INET,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        );
    }
    if size < 4 || size > 8 * 1024 * 1024 {
        return Err("Windows TCP 监听表大小无效".into());
    }
    let mut words = vec![0_u32; (size as usize).div_ceil(4)];
    let status = unsafe {
        GetExtendedTcpTable(
            words.as_mut_ptr().cast(),
            &mut size,
            0,
            AF_INET,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        )
    };
    if status != 0 {
        return Err(format!("读取 Windows TCP 监听表失败：{status}"));
    }
    if size < 4 {
        return Err("Windows TCP 监听表头无效".into());
    }
    let count = words[0] as usize;
    let row_size = std::mem::size_of::<TcpRowOwnerPid>();
    if count > (size as usize - 4) / row_size {
        return Err("Windows TCP 监听表行数无效".into());
    }
    let expected_addr = u32::from_ne_bytes([127, 0, 0, 1]);
    let mut owners = Vec::new();
    for index in 0..count {
        let pointer = unsafe { (words.as_ptr().cast::<u8>()).add(4 + index * row_size) };
        let row: TcpRowOwnerPid = unsafe { pointer.cast::<TcpRowOwnerPid>().read_unaligned() };
        if row.state == LISTEN
            && row.local_addr == expected_addr
            && u16::from_be(row.local_port as u16) == port
        {
            owners.push(row.owning_pid);
        }
    }
    Ok((owners.len() == 1).then(|| owners[0]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restart_guard_preserves_a_live_process_and_clears_stale_identity() {
        let root =
            std::env::temp_dir().join(format!("taskboard-restart-{}", rand::random::<u64>()));
        fs::create_dir(&root).unwrap();
        let marker = root.join("active.json");
        fs::write(&marker, r#"{"state":"pending","launch":"interrupted"}"#).unwrap();
        assert!(reject_running_previous(&marker)
            .unwrap_err()
            .contains("拒绝重复启动"));
        assert!(marker.exists());
        let pid = std::process::id();
        let (ticks, running) = process_state_by_pid(pid).unwrap().unwrap();
        assert!(running);
        fs::write(
            &marker,
            serde_json::json!({ "pid": pid, "createdTicks": ticks.to_string() }).to_string(),
        )
        .unwrap();
        assert!(reject_running_previous(&marker)
            .unwrap_err()
            .contains("未发送草稿"));
        assert!(marker.exists());
        fs::write(
            &marker,
            serde_json::json!({ "pid": pid, "createdTicks": (ticks - 1).to_string() }).to_string(),
        )
        .unwrap();
        reject_running_previous(&marker).unwrap();
        assert!(!marker.exists());
        fs::remove_dir(root).unwrap();
    }

    #[test]
    fn private_control_requires_its_own_key_and_never_invents_a_session() {
        let state = Arc::new(Mutex::new(None));
        let port = start_control(state, "K".repeat(48)).unwrap();
        let request = |key: &str, path: &str| {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            write!(stream, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nx-taskboard-control-key: {key}\r\nConnection: close\r\n\r\n").unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            response
        };
        assert!(request("wrong", "/session").starts_with("HTTP/1.1 403 Forbidden"));
        assert!(request(&"K".repeat(48), "/session").contains("{\"session\":null}"));
        assert!(request(&"K".repeat(48), "/verify/old").contains("{\"valid\":false}"));
    }

    #[test]
    fn loopback_listener_owner_is_current_process() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert_eq!(listener_owner(port).unwrap(), Some(std::process::id()));
        drop(listener);
    }

    fn read_test_request(stream: &mut TcpStream) -> String {
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut request = Vec::new();
        while !request.windows(4).any(|part| part == b"\r\n\r\n") {
            let mut chunk = [0_u8; 512];
            let count = stream.read(&mut chunk).unwrap();
            assert!(count > 0 && request.len() + count <= 4096);
            request.extend_from_slice(&chunk[..count]);
        }
        String::from_utf8(request).unwrap()
    }

    fn serve_targets(body: String) -> (u16, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let worker = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            read_test_request(&mut stream);
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
        });
        (port, worker)
    }

    #[test]
    fn exact_main_page_binding_rejects_other_websocket() {
        let id = "A1B2C3D4E5F60123456789ABCDEF0123";
        let (port, worker) = serve_targets(format!(
            r#"[{{"id":"{id}","type":"page","url":"app://-/index.html","webSocketDebuggerUrl":"ws://127.0.0.1:1/devtools/page/{id}"}}]"#
        ));
        assert!(fetch_target(port).is_err());
        worker.join().unwrap();
    }

    #[test]
    fn exact_main_page_binding_accepts_unique_page() {
        let id = "A1B2C3D4E5F60123456789ABCDEF0123";
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let worker = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            read_test_request(&mut stream);
            let body = format!(
                r#"[{{"id":"{id}","type":"page","url":"app://-/index.html","webSocketDebuggerUrl":"ws://127.0.0.1:{port}/devtools/page/{id}"}},{{"id":"OTHER","type":"page","url":"app://-/overlay.html"}}]"#
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
        });
        let target = fetch_target(port).unwrap();
        assert_eq!(target.id, id);
        assert_eq!(target.page_url, CODEX_PAGE);
        worker.join().unwrap();
    }

    #[test]
    fn exact_main_page_binding_accepts_complete_keepalive_response() {
        let id = "A1B2C3D4E5F60123456789ABCDEF0123";
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (release, wait) = std::sync::mpsc::channel::<()>();
        let worker = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_test_request(&mut stream);
            assert!(request.contains(&format!("\r\nHost: 127.0.0.1:{port}\r\n")));
            let body = format!(
                r#"[{{"id":"{id}","type":"page","url":"app://-/index.html","webSocketDebuggerUrl":"ws://127.0.0.1:{port}/devtools/page/{id}"}}]"#
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length:{}\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
            wait.recv_timeout(Duration::from_secs(2)).unwrap();
        });
        let target = fetch_target(port).unwrap();
        assert_eq!(target.id, id);
        release.send(()).unwrap();
        worker.join().unwrap();
    }

    #[test]
    #[ignore = "run only with TASKBOARD_TEST_CDP_PORT and TASKBOARD_TEST_CDP_PID for an isolated owned Codex"]
    fn live_installed_cdp_diagnostic() {
        let port = std::env::var("TASKBOARD_TEST_CDP_PORT")
            .unwrap()
            .parse::<u16>()
            .unwrap();
        let pid = std::env::var("TASKBOARD_TEST_CDP_PID")
            .unwrap()
            .parse::<u32>()
            .unwrap();
        let owner = listener_owner(port);
        let target = fetch_target(port);
        println!("listener owner: {owner:?}; exact target: {target:?}");
        assert_eq!(owner.unwrap(), Some(pid));
        assert!(target.is_ok());
    }

    #[test]
    #[ignore = "run only on a machine whose installed Codex version is outside the verified list"]
    fn newer_installed_codex_is_refused_before_launch() {
        assert!(discover_launchable_executable().is_err());
    }

    #[test]
    #[ignore = "run only on a machine with the verified Codex package installed"]
    fn verified_installed_codex_is_discovered_without_launch() {
        assert!(discover_launchable_executable().unwrap().is_file());
    }
}
