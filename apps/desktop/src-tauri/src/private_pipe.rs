//! Bounded local IPC. OS-reported peers and a current-user-only DACL are required.
use crate::owned_process::{inspect, ProcessIdentity};
use serde_json::Value;
use std::{
    ffi::c_void,
    os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
    thread,
    time::{Duration, Instant},
};

type Handle = *mut c_void;
const INVALID: Handle = -1_isize as Handle;
const TIMEOUT: Duration = Duration::from_secs(45);
const MAX_MESSAGE: usize = 32768;

pub struct Pipe {
    handle: OwnedHandle,
    deadline: Instant,
}

impl Pipe {
    pub fn create(name: &str) -> Result<Self, String> {
        let name = pipe_name(name)?;
        let sddl = wide(&format!("D:P(A;;GA;;;{})", current_sid()?));
        let mut descriptor = std::ptr::null_mut();
        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                1,
                &mut descriptor,
                std::ptr::null_mut(),
            )
        } == 0
        {
            return Err(error("创建管道权限"));
        }
        let mut attributes = SecurityAttributes {
            length: std::mem::size_of::<SecurityAttributes>() as u32,
            descriptor,
            inherit: 0,
        };
        let handle = unsafe {
            CreateNamedPipeW(
                name.as_ptr(),
                3 | 0x0008_0000,
                1 | 8,
                1,
                MAX_MESSAGE as u32,
                MAX_MESSAGE as u32,
                0,
                &mut attributes,
            )
        };
        unsafe {
            LocalFree(descriptor);
        }
        if handle == INVALID {
            return Err(error("创建独占管道"));
        }
        Ok(Self {
            handle: unsafe { OwnedHandle::from_raw_handle(handle) },
            deadline: Instant::now() + TIMEOUT,
        })
    }

    pub fn connect(name: &str) -> Result<Self, String> {
        let name = pipe_name(name)?;
        let deadline = Instant::now() + TIMEOUT;
        loop {
            let handle = unsafe {
                CreateFileW(
                    name.as_ptr(),
                    0xc0000000,
                    0,
                    std::ptr::null_mut(),
                    3,
                    0x0010_0000,
                    std::ptr::null_mut(),
                )
            };
            if handle != INVALID {
                let handle = unsafe { OwnedHandle::from_raw_handle(handle) };
                let mode = 1_u32;
                if unsafe {
                    SetNamedPipeHandleState(
                        handle.as_raw_handle(),
                        &mode,
                        std::ptr::null(),
                        std::ptr::null(),
                    )
                } == 0
                {
                    return Err(error("设置管道非阻塞模式"));
                }
                return Ok(Self { handle, deadline });
            }
            let code = unsafe { GetLastError() };
            if !matches!(code, 2 | 231) {
                return Err(format!("连接私有管道失败：{code}"));
            }
            poll(deadline)?;
        }
    }

    pub fn accept(&self) -> Result<(), String> {
        loop {
            if unsafe { ConnectNamedPipe(self.handle.as_raw_handle(), std::ptr::null_mut()) } != 0 {
                return Ok(());
            }
            match unsafe { GetLastError() } {
                535 => return Ok(()),
                536 => poll(self.deadline)?,
                code => return Err(format!("等待辅助进程失败：{code}")),
            }
        }
    }

    pub fn peer(&self, server: bool) -> Result<(OwnedHandle, ProcessIdentity), String> {
        let mut pid = 0;
        let ok = unsafe {
            if server {
                GetNamedPipeClientProcessId(self.handle.as_raw_handle(), &mut pid)
            } else {
                GetNamedPipeServerProcessId(self.handle.as_raw_handle(), &mut pid)
            }
        };
        if ok == 0 || pid == 0 {
            return Err(error("读取管道通信方"));
        }
        let handle = unsafe { OpenProcess(0x1000 | 0x40 | 0x0010_0000, 0, pid) };
        if handle.is_null() {
            return Err(error("持有管道通信方句柄"));
        }
        let handle = unsafe { OwnedHandle::from_raw_handle(handle) };
        let identity = inspect(handle.as_raw_handle())?;
        // Recheck the kernel peer after acquiring the process object, closing PID reuse races.
        let mut again = 0;
        let ok = unsafe {
            if server {
                GetNamedPipeClientProcessId(self.handle.as_raw_handle(), &mut again)
            } else {
                GetNamedPipeServerProcessId(self.handle.as_raw_handle(), &mut again)
            }
        };
        if ok == 0
            || again != identity.pid
            || unsafe { WaitForSingleObject(handle.as_raw_handle(), 0) } != 258
        {
            return Err("管道通信方身份已失效".into());
        }
        Ok((handle, identity))
    }

    pub fn send(&self, value: &Value) -> Result<(), String> {
        let body = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        if body.len() > MAX_MESSAGE {
            return Err("私有通道消息过大".into());
        }
        let mut bytes = (body.len() as u32).to_le_bytes().to_vec();
        bytes.extend(body);
        let mut offset = 0;
        while offset < bytes.len() {
            let mut written = 0;
            let ok = unsafe {
                WriteFile(
                    self.handle.as_raw_handle(),
                    bytes[offset..].as_ptr().cast(),
                    (bytes.len() - offset) as u32,
                    &mut written,
                    std::ptr::null_mut(),
                )
            };
            if ok == 0 {
                return Err(error("发送私有通道消息"));
            }
            offset += written as usize;
            if offset < bytes.len() {
                poll(self.deadline)?;
            }
        }
        Ok(())
    }

    pub fn receive(&self) -> Result<Value, String> {
        let mut length = [0_u8; 4];
        self.read_exact(&mut length)?;
        let length = u32::from_le_bytes(length) as usize;
        if length == 0 || length > MAX_MESSAGE {
            return Err("私有通道消息长度无效".into());
        }
        let mut bytes = vec![0; length];
        self.read_exact(&mut bytes)?;
        serde_json::from_slice(&bytes).map_err(|_| "私有通道消息不是有效 JSON".into())
    }

    fn read_exact(&self, bytes: &mut [u8]) -> Result<(), String> {
        let mut offset = 0;
        while offset < bytes.len() {
            let mut count = 0;
            let ok = unsafe {
                ReadFile(
                    self.handle.as_raw_handle(),
                    bytes[offset..].as_mut_ptr().cast(),
                    (bytes.len() - offset) as u32,
                    &mut count,
                    std::ptr::null_mut(),
                )
            };
            if ok == 0 && unsafe { GetLastError() } != 232 {
                return Err(error("读取私有通道消息"));
            }
            offset += count as usize;
            if offset < bytes.len() {
                poll(self.deadline)?;
            }
        }
        Ok(())
    }
}

fn poll(deadline: Instant) -> Result<(), String> {
    if Instant::now() >= deadline {
        return Err("包上下文交接超时；请先核对独立窗口，未自动重复启动".into());
    }
    thread::sleep(Duration::from_millis(10));
    Ok(())
}

fn pipe_name(name: &str) -> Result<Vec<u16>, String> {
    if name.len() != 48 || !name.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err("私有管道名称无效".into());
    }
    Ok(wide(&format!(r"\\.\pipe\CodexTaskboard-{name}")))
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
fn error(action: &str) -> String {
    format!("{action}失败：{}", std::io::Error::last_os_error())
}

fn current_sid() -> Result<String, String> {
    let mut token = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), 8, &mut token) } == 0 {
        return Err(error("读取当前用户"));
    }
    let token = unsafe { OwnedHandle::from_raw_handle(token) };
    let mut size = 0;
    unsafe {
        GetTokenInformation(token.as_raw_handle(), 1, std::ptr::null_mut(), 0, &mut size);
    }
    if size == 0 || size > 65536 {
        return Err("当前用户令牌大小无效".into());
    }
    // Aligned storage for TOKEN_USER and its pointed-to SID.
    let mut storage = vec![0_usize; (size as usize).div_ceil(std::mem::size_of::<usize>())];
    if unsafe {
        GetTokenInformation(
            token.as_raw_handle(),
            1,
            storage.as_mut_ptr().cast(),
            size,
            &mut size,
        )
    } == 0
    {
        return Err(error("读取当前用户令牌"));
    }
    let sid = storage[0] as Handle;
    let mut text = std::ptr::null_mut();
    if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 {
        return Err(error("转换用户标识"));
    }
    let value = unsafe {
        let mut len = 0;
        while len < 256 && *text.add(len) != 0 {
            len += 1;
        }
        String::from_utf16(std::slice::from_raw_parts(text, len))
    };
    unsafe {
        LocalFree(text.cast());
    }
    value.map_err(|_| "用户标识编码无效".into())
}

#[repr(C)]
struct SecurityAttributes {
    length: u32,
    descriptor: Handle,
    inherit: i32,
}
#[link(name = "kernel32")]
extern "system" {
    fn CreateNamedPipeW(
        name: *const u16,
        open: u32,
        mode: u32,
        instances: u32,
        output: u32,
        input: u32,
        timeout: u32,
        security: *mut SecurityAttributes,
    ) -> Handle;
    fn CreateFileW(
        name: *const u16,
        access: u32,
        sharing: u32,
        security: Handle,
        creation: u32,
        flags: u32,
        template: Handle,
    ) -> Handle;
    fn SetNamedPipeHandleState(
        pipe: Handle,
        mode: *const u32,
        count: *const u32,
        timeout: *const u32,
    ) -> i32;
    fn ConnectNamedPipe(pipe: Handle, overlapped: Handle) -> i32;
    fn GetNamedPipeClientProcessId(pipe: Handle, pid: *mut u32) -> i32;
    fn GetNamedPipeServerProcessId(pipe: Handle, pid: *mut u32) -> i32;
    fn ReadFile(file: Handle, buffer: Handle, size: u32, read: *mut u32, overlapped: Handle)
        -> i32;
    fn WriteFile(
        file: Handle,
        buffer: *const c_void,
        size: u32,
        written: *mut u32,
        overlapped: Handle,
    ) -> i32;
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
    fn WaitForSingleObject(handle: Handle, timeout: u32) -> u32;
    fn GetCurrentProcess() -> Handle;
    fn GetLastError() -> u32;
    fn LocalFree(memory: Handle) -> Handle;
}
#[link(name = "advapi32")]
extern "system" {
    fn OpenProcessToken(process: Handle, access: u32, token: *mut Handle) -> i32;
    fn GetTokenInformation(
        token: Handle,
        class: u32,
        buffer: Handle,
        size: u32,
        returned: *mut u32,
    ) -> i32;
    fn ConvertSidToStringSidW(sid: Handle, text: *mut *mut u16) -> i32;
    fn ConvertStringSecurityDescriptorToSecurityDescriptorW(
        text: *const u16,
        revision: u32,
        descriptor: *mut Handle,
        size: *mut u32,
    ) -> i32;
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pipe_authenticates_os_peer_and_exchanges_bounded_messages() {
        let name = format!("{:048}", rand::random::<u128>());
        let server = Pipe::create(&name).unwrap();
        assert!(Pipe::create(&name).is_err());
        let worker = thread::spawn(move || {
            let client = Pipe::connect(&name).unwrap();
            assert_eq!(client.peer(false).unwrap().1.pid, std::process::id());
            client.send(&serde_json::json!({"hello": true})).unwrap();
            assert_eq!(client.receive().unwrap()["ok"], true);
        });
        server.accept().unwrap();
        assert_eq!(server.peer(true).unwrap().1.pid, std::process::id());
        assert_eq!(server.receive().unwrap()["hello"], true);
        assert!(server
            .send(&serde_json::json!({"data": "x".repeat(MAX_MESSAGE)}))
            .is_err());
        server.send(&serde_json::json!({"ok": true})).unwrap();
        worker.join().unwrap();
    }
    #[test]
    fn invalid_names_and_accept_timeout_fail_closed() {
        assert!(Pipe::create("invalid/path").is_err());
        let mut pipe = Pipe::create(&format!("{:048}", rand::random::<u128>())).unwrap();
        pipe.deadline = Instant::now();
        assert!(pipe.accept().unwrap_err().contains("超时"));
    }

    #[test]
    fn oversized_wire_length_is_refused_without_allocating_payload() {
        let name = format!("{:048}", rand::random::<u128>());
        let server = Pipe::create(&name).unwrap();
        let client = Pipe::connect(&name).unwrap();
        server.accept().unwrap();
        let bytes = u32::MAX.to_le_bytes();
        let mut count = 0;
        assert_ne!(
            unsafe {
                WriteFile(
                    client.handle.as_raw_handle(),
                    bytes.as_ptr().cast(),
                    4,
                    &mut count,
                    std::ptr::null_mut(),
                )
            },
            0
        );
        assert!(server.receive().unwrap_err().contains("消息长度无效"));
    }

    #[test]
    fn silent_or_disconnected_helper_cannot_block_indefinitely() {
        let name = format!("{:048}", rand::random::<u128>());
        let mut server = Pipe::create(&name).unwrap();
        let client = Pipe::connect(&name).unwrap();
        server.accept().unwrap();
        server.deadline = Instant::now() + Duration::from_millis(30);
        assert!(server.receive().unwrap_err().contains("超时"));
        drop(client);
        assert!(server.receive().is_err());
    }
}
