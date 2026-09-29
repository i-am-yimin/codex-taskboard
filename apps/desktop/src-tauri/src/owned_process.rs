//! A process object retained by handle, never reconstructed from a reported PID.
//! Remote handle transfer requires an independently authenticated helper handle.

use std::{
    ffi::{c_void, OsString},
    fs,
    os::windows::{
        ffi::OsStringExt,
        io::{AsRawHandle, BorrowedHandle, FromRawHandle, OwnedHandle},
    },
    path::{Path, PathBuf},
    process::Child,
};

type Handle = *mut c_void;
const QUERY: u32 = 0x1000;
const SYNCHRONIZE: u32 = 0x0010_0000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessIdentity {
    pub pid: u32,
    pub created_ticks: u64,
    pub executable: PathBuf,
    pub package: Option<String>,
}

pub struct OwnedProcess {
    handle: OwnedHandle,
    identity: ProcessIdentity,
}

impl OwnedProcess {
    pub fn from_child(child: &Child, executable: &Path) -> Result<Self, String> {
        let handle = duplicate(
            unsafe { GetCurrentProcess() },
            child.as_raw_handle() as usize,
        )?;
        let identity = inspect(handle.as_raw_handle())?;
        if identity.pid != child.id()
            || identity.executable != fs::canonicalize(executable).map_err(|e| e.to_string())?
        {
            return Err("Codex 子进程句柄与预期可执行文件不符".into());
        }
        let process = Self { handle, identity };
        if !process.verify() {
            return Err("Codex 子进程在持有权确认前退出".into());
        }
        Ok(process)
    }

    /// The source must come from a separately authenticated transport peer;
    /// opening a PID supplied in the payload does not authenticate a helper.
    /// `expected` must contain launcher-selected executable/package identity.
    pub fn receive(
        source: BorrowedHandle<'_>,
        remote_handle: usize,
        expected: &ProcessIdentity,
    ) -> Result<Self, String> {
        let handle = duplicate(source.as_raw_handle(), remote_handle)?;
        let identity = inspect(handle.as_raw_handle())?;
        if &identity != expected {
            return Err("辅助进程交接的进程身份与启动会话不符".into());
        }
        let process = Self { handle, identity };
        if !process.verify() {
            return Err("辅助进程交接的子进程已退出".into());
        }
        Ok(process)
    }

    pub fn identity(&self) -> &ProcessIdentity {
        &self.identity
    }

    pub fn is_running(&self) -> bool {
        // Exit code 259 is also a legitimate final exit code; use the wait state.
        unsafe { WaitForSingleObject(self.handle.as_raw_handle(), 0) == 258 }
    }

    pub fn verify(&self) -> bool {
        self.is_running() && inspect(self.handle.as_raw_handle()).as_ref() == Ok(&self.identity)
    }
}

fn duplicate(source: Handle, remote_handle: usize) -> Result<OwnedHandle, String> {
    // Reject null and all Windows pseudo-handle values, including -1 (current
    // process). A payload must identify a real child handle in the source table.
    if remote_handle == 0 || remote_handle >= isize::MAX as usize {
        return Err("进程交接句柄值无效".into());
    }
    let mut handle = std::ptr::null_mut();
    let result = unsafe {
        DuplicateHandle(
            source,
            remote_handle as Handle,
            GetCurrentProcess(),
            &mut handle,
            QUERY | SYNCHRONIZE,
            0,
            0,
        )
    };
    if result == 0 {
        return Err(format!(
            "复制进程句柄失败：{}",
            std::io::Error::last_os_error()
        ));
    }
    // No terminate or duplicate privilege is granted to the retained child handle.
    Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
}

pub(crate) fn inspect(handle: Handle) -> Result<ProcessIdentity, String> {
    let pid = unsafe { GetProcessId(handle) };
    if pid == 0 {
        return Err("交接对象不是可查询的进程句柄".into());
    }
    let (mut created, mut exited, mut kernel, mut user) = (
        FileTime::default(),
        FileTime::default(),
        FileTime::default(),
        FileTime::default(),
    );
    if unsafe { GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) } == 0 {
        return Err("无法核对进程创建时间".into());
    }
    let created_ticks = (u64::from(created.high) << 32) | u64::from(created.low);
    if created_ticks == 0 {
        return Err("进程创建时间无效".into());
    }
    let mut path = vec![0_u16; 32768];
    let mut length = path.len() as u32;
    if unsafe { QueryFullProcessImageNameW(handle, 0, path.as_mut_ptr(), &mut length) } == 0 {
        return Err("无法核对进程可执行文件".into());
    }
    let executable = fs::canonicalize(PathBuf::from(OsString::from_wide(&path[..length as usize])))
        .map_err(|e| format!("无法解析进程可执行文件：{e}"))?;
    let mut package_length = 0;
    let status = unsafe { GetPackageFullName(handle, &mut package_length, std::ptr::null_mut()) };
    let package = if status == 15700 {
        // APPMODEL_ERROR_NO_PACKAGE
        None
    } else {
        if status != 122 || package_length == 0 || package_length > 32768 {
            return Err(format!("无法读取进程包身份：{status}"));
        }
        let mut value = vec![0_u16; package_length as usize];
        let status = unsafe { GetPackageFullName(handle, &mut package_length, value.as_mut_ptr()) };
        if status != 0
            || package_length < 2
            || package_length as usize > value.len()
            || value[package_length as usize - 1] != 0
        {
            return Err(format!("进程包身份无效：{status}"));
        }
        Some(
            String::from_utf16(&value[..package_length as usize - 1])
                .map_err(|_| "进程包身份编码无效")?,
        )
    };
    Ok(ProcessIdentity {
        pid,
        created_ticks,
        executable,
        package,
    })
}

#[repr(C)]
#[derive(Default)]
struct FileTime {
    low: u32,
    high: u32,
}

#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentProcess() -> Handle;
    fn DuplicateHandle(
        source: Handle,
        original: Handle,
        target: Handle,
        duplicate: *mut Handle,
        access: u32,
        inherit: i32,
        options: u32,
    ) -> i32;
    fn GetProcessId(process: Handle) -> u32;
    fn WaitForSingleObject(handle: Handle, timeout: u32) -> u32;
    fn GetProcessTimes(
        process: Handle,
        created: *mut FileTime,
        exited: *mut FileTime,
        kernel: *mut FileTime,
        user: *mut FileTime,
    ) -> i32;
    fn QueryFullProcessImageNameW(
        process: Handle,
        flags: u32,
        name: *mut u16,
        size: *mut u32,
    ) -> i32;
    fn GetPackageFullName(process: Handle, length: *mut u32, name: *mut u16) -> i32;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader, Write},
        os::windows::{io::AsHandle, process::CommandExt},
        process::{Command, Stdio},
    };

    struct TestChild(Child);
    impl Drop for TestChild {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }

    fn child() -> (TestChild, PathBuf) {
        let executable = std::env::current_exe().unwrap();
        let child = Command::new(&executable)
            .args([
                "--exact",
                "owned_process::tests::child_waits_for_stdin",
                "--ignored",
            ])
            .env("TASKBOARD_HANDLE_TEST_CHILD", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(0x08000000)
            .spawn()
            .unwrap();
        (TestChild(child), executable)
    }

    #[test]
    #[ignore = "child process fixture; spawned by the handle tests"]
    fn child_waits_for_stdin() {
        assert_eq!(std::env::var("TASKBOARD_HANDLE_TEST_CHILD").unwrap(), "1");
        let mut line = String::new();
        std::io::stdin().read_line(&mut line).unwrap();
        if line.trim() == "exit259" {
            std::process::exit(259);
        }
    }

    #[test]
    fn held_object_survives_source_handle_close_and_revokes_on_exit() {
        let (mut child, path) = child();
        let held = OwnedProcess::from_child(&child.0, &path).unwrap();
        let peer = unsafe { BorrowedHandle::borrow_raw(GetCurrentProcess()) };
        let received =
            OwnedProcess::receive(peer, held.handle.as_raw_handle() as usize, held.identity())
                .unwrap();
        drop(held);
        assert!(received.verify());
        child.0.kill().unwrap();
        child.0.wait().unwrap();
        assert!(!received.verify());
    }

    #[test]
    fn exit_code_259_is_not_a_running_process() {
        let (mut child, path) = child();
        let held = OwnedProcess::from_child(&child.0, &path).unwrap();
        child
            .0
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"exit259\n")
            .unwrap();
        assert_eq!(child.0.wait().unwrap().code(), Some(259));
        assert!(!held.is_running());
        assert!(!held.verify());
    }

    #[test]
    fn rejects_each_identity_mismatch_and_invalid_handle() {
        let (child, path) = child();
        let held = OwnedProcess::from_child(&child.0, &path).unwrap();
        let peer = unsafe { BorrowedHandle::borrow_raw(GetCurrentProcess()) };
        let mut mismatches = vec![held.identity().clone(); 4];
        mismatches[0].pid ^= 1;
        mismatches[1].created_ticks += 1;
        mismatches[2].executable = PathBuf::from("C:\\untrusted.exe");
        mismatches[3].package = Some("untrusted-package".into());
        for identity in mismatches {
            assert!(
                OwnedProcess::receive(peer, held.handle.as_raw_handle() as usize, &identity)
                    .is_err()
            );
        }
        for invalid in [0, usize::MAX, usize::MAX - 1] {
            assert!(OwnedProcess::receive(peer, invalid, held.identity()).is_err());
        }
        let file = fs::File::open(path).unwrap();
        assert!(OwnedProcess::receive(
            peer,
            file.as_handle().as_raw_handle() as usize,
            held.identity()
        )
        .is_err());
        assert!(held.verify());
    }

    #[test]
    fn dropping_owned_handle_preserves_live_child() {
        let (mut child, path) = child();
        let held = OwnedProcess::from_child(&child.0, &path).unwrap();
        drop(held);
        assert!(child.0.try_wait().unwrap().is_none());
        assert!(OwnedProcess::from_child(&child.0, Path::new("C:\\wrong.exe")).is_err());
        assert!(child.0.try_wait().unwrap().is_none());
    }

    #[test]
    #[ignore = "remote process fixture; spawned by the transfer test"]
    fn remote_source() {
        assert_eq!(std::env::var("TASKBOARD_HANDLE_TEST_CHILD").unwrap(), "1");
        let (child, path) = child();
        let held = OwnedProcess::from_child(&child.0, &path).unwrap();
        println!(
            "TRANSFER {} {} {}",
            held.handle.as_raw_handle() as usize,
            held.identity().pid,
            held.identity().created_ticks
        );
        std::io::stdout().flush().unwrap();
        let mut line = String::new();
        std::io::stdin().read_line(&mut line).unwrap();
        drop(held);
        println!("SOURCE_CLOSED");
        std::io::stdout().flush().unwrap();
        std::io::stdin().read_line(&mut line).unwrap();
        // TestChild cleans up only this fixture's own child on return.
    }

    #[test]
    fn duplicates_from_real_remote_handle_table() {
        let executable = std::env::current_exe().unwrap();
        let mut helper = TestChild(
            Command::new(&executable)
                .args([
                    "--exact",
                    "owned_process::tests::remote_source",
                    "--ignored",
                    "--nocapture",
                ])
                .env("TASKBOARD_HANDLE_TEST_CHILD", "1")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .creation_flags(0x08000000)
                .spawn()
                .unwrap(),
        );
        let mut output = BufReader::new(helper.0.stdout.take().unwrap());
        let mut read_until = |prefix: &str| -> String {
            loop {
                let mut line = String::new();
                assert_ne!(output.read_line(&mut line).unwrap(), 0);
                if line.starts_with(prefix) {
                    return line;
                }
            }
        };
        let message = read_until("TRANSFER ");
        let fields: Vec<&str> = message.split_whitespace().collect();
        let expected = ProcessIdentity {
            pid: fields[2].parse().unwrap(),
            created_ticks: fields[3].parse().unwrap(),
            executable: fs::canonicalize(executable).unwrap(),
            package: inspect(unsafe { GetCurrentProcess() }).unwrap().package,
        };
        let held =
            OwnedProcess::receive(helper.0.as_handle(), fields[1].parse().unwrap(), &expected)
                .unwrap();
        helper
            .0
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"close source handle\n")
            .unwrap();
        read_until("SOURCE_CLOSED");
        assert!(held.verify());
        helper
            .0
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"finish fixture\n")
            .unwrap();
        assert!(helper.0.wait().unwrap().success());
        assert!(!held.verify());
    }
}
