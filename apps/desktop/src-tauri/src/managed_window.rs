//! Restore only the unique main window of the launcher's retained process.
//! Titles and renderer-supplied PIDs never authorize window operations.

use crate::owned_process::OwnedProcess;
use std::{ffi::c_void, thread, time::{Duration, Instant}};

type Window = isize;
const GW_OWNER: u32 = 4;
const GWL_STYLE: i32 = -16;
const GWL_EXSTYLE: i32 = -20;
const WS_CHILD: u32 = 0x4000_0000;
const WS_CAPTION: u32 = 0x00c0_0000;
const WS_EX_TOOLWINDOW: u32 = 0x80;
const WS_EX_NOACTIVATE: u32 = 0x0800_0000;
const SW_SHOW: i32 = 5;
const SW_RESTORE: i32 = 9;
const DWMWA_CLOAKED: u32 = 14;

#[link(name = "user32")]
extern "system" {
    fn EnumWindows(callback: unsafe extern "system" fn(Window, isize) -> i32, data: isize) -> i32;
    fn GetWindowThreadProcessId(window: Window, pid: *mut u32) -> u32;
    fn GetClassNameW(window: Window, class: *mut u16, capacity: i32) -> i32;
    fn GetWindow(window: Window, command: u32) -> Window;
    fn GetWindowLongPtrW(window: Window, index: i32) -> isize;
    fn IsWindowVisible(window: Window) -> i32;
    fn IsIconic(window: Window) -> i32;
    fn ShowWindowAsync(window: Window, command: i32) -> i32;
    fn SetForegroundWindow(window: Window) -> i32;
    fn GetForegroundWindow() -> Window;
}
#[link(name = "dwmapi")]
extern "system" {
    fn DwmGetWindowAttribute(window: Window, attribute: u32, value: *mut c_void, size: u32) -> i32;
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct MainWindow {
    handle: Window,
    pid: u32,
    class: String,
    owner: Window,
    style: u32,
    extended_style: u32,
    cloaked: u32,
}

fn inspect(window: Window) -> Option<MainWindow> {
    let mut pid = 0;
    if unsafe { GetWindowThreadProcessId(window, &mut pid) } == 0 { return None; }
    let mut class = [0_u16; 256];
    let length = unsafe { GetClassNameW(window, class.as_mut_ptr(), class.len() as i32) };
    if length <= 0 { return None; }
    let mut cloaked: u32 = 0;
    if unsafe { DwmGetWindowAttribute(window, DWMWA_CLOAKED,
        (&mut cloaked as *mut u32).cast(), std::mem::size_of::<u32>() as u32) } != 0 { return None; }
    Some(MainWindow {
        handle: window, pid,
        class: String::from_utf16_lossy(&class[..length as usize]),
        owner: unsafe { GetWindow(window, GW_OWNER) },
        style: unsafe { GetWindowLongPtrW(window, GWL_STYLE) } as u32,
        extended_style: unsafe { GetWindowLongPtrW(window, GWL_EXSTYLE) } as u32,
        cloaked,
    })
}

fn is_main(window: &MainWindow, pid: u32) -> bool {
    window.pid == pid && window.class == "Chrome_WidgetWin_1" && window.owner == 0
        && window.style & WS_CHILD == 0 && window.style & WS_CAPTION == WS_CAPTION
        && window.extended_style & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) == 0
        && window.cloaked == 0
}

struct Enumeration { pid: u32, candidates: Vec<MainWindow> }
unsafe extern "system" fn collect(window: Window, data: isize) -> i32 {
    let enumeration = &mut *(data as *mut Enumeration);
    // Ignore unrelated windows before inspecting their metadata.
    let mut pid = 0;
    if GetWindowThreadProcessId(window, &mut pid) != 0 && pid == enumeration.pid {
        if let Some(candidate) = inspect(window) {
            if is_main(&candidate, enumeration.pid) { enumeration.candidates.push(candidate); }
        }
    }
    1
}

fn unique_main(pid: u32) -> Result<MainWindow, String> {
    let mut enumeration = Enumeration { pid, candidates: Vec::new() };
    if unsafe { EnumWindows(collect, (&mut enumeration as *mut Enumeration) as isize) } == 0 {
        return Err("无法读取独立 Codex 窗口；请稍后重试".into());
    }
    if enumeration.candidates.len() != 1 {
        return Err("独立 Codex 正在运行，但无法唯一确认可恢复的主窗口；请检查任务栏后重试".into());
    }
    Ok(enumeration.candidates.remove(0))
}

pub(super) fn restore(process: &OwnedProcess, verify_binding: impl Fn() -> bool) -> Result<bool, String> {
    restore_verified(process.identity().pid, || process.verify() && verify_binding())
}

fn restore_verified(pid: u32, verify: impl Fn() -> bool) -> Result<bool, String> {
    if !verify() { return Err("独立 Codex 的进程或页面归属已变化，已拒绝恢复窗口".into()); }
    let window = unique_main(pid)?;
    // Re-enumerate immediately before input, rejecting handle reuse or ambiguity.
    if !verify() || unique_main(pid)? != window {
        return Err("独立 Codex 窗口归属已变化，已拒绝恢复窗口".into());
    }
    // Preserve a maximized or already visible window; only restore minimization.
    let command = if unsafe { IsIconic(window.handle) } != 0 { SW_RESTORE } else { SW_SHOW };
    if unsafe { ShowWindowAsync(window.handle, command) } == 0 {
        return Err("无法显示独立 Codex 窗口；请从任务栏恢复后重试".into());
    }
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        if !verify() || !inspect(window.handle).is_some_and(|current| is_main(&current, pid)) {
            return Err("恢复期间独立 Codex 的归属已变化".into());
        }
        if unsafe { IsWindowVisible(window.handle) } != 0 && unsafe { IsIconic(window.handle) } == 0 { break; }
        if Instant::now() >= deadline { return Err("独立 Codex 窗口未能显示；请稍后重试".into()); }
        thread::sleep(Duration::from_millis(25));
    }
    if unique_main(pid)?.handle != window.handle || !verify() {
        return Err("独立 Codex 主窗口已变化，已拒绝切换焦点".into());
    }
    // Windows may deny foreground focus. Visibility is checked independently.
    let focused = unsafe { SetForegroundWindow(window.handle) } != 0
        || unsafe { GetForegroundWindow() } == window.handle;
    Ok(focused)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    static WINDOWS: Mutex<()> = Mutex::new(());
    #[repr(C)]
    struct WindowClass {
        style: u32,
        procedure: unsafe extern "system" fn(Window, u32, usize, isize) -> isize,
        class_extra: i32, window_extra: i32, instance: isize, icon: isize,
        cursor: isize, background: isize, menu: *const u16, name: *const u16,
    }
    #[link(name = "user32")]
    extern "system" {
        fn RegisterClassW(class: *const WindowClass) -> u16;
        fn CreateWindowExW(ex: u32, class: *const u16, title: *const u16, style: u32,
            x: i32, y: i32, width: i32, height: i32, parent: Window,
            menu: isize, instance: isize, param: *mut c_void) -> Window;
        fn DefWindowProcW(window: Window, message: u32, wparam: usize, lparam: isize) -> isize;
        fn ShowWindow(window: Window, command: i32) -> i32;
        fn IsZoomed(window: Window) -> i32;
        fn PostMessageW(window: Window, message: u32, wparam: usize, lparam: isize) -> i32;
        fn PostQuitMessage(code: i32);
        fn GetMessageW(message: *mut Message, window: Window, min: u32, max: u32) -> i32;
        fn TranslateMessage(message: *const Message) -> i32;
        fn DispatchMessageW(message: *const Message) -> isize;
    }
    #[repr(C)]
    struct Message {
        window: Window, message: u32, wparam: usize, lparam: isize,
        time: u32, point: [i32; 2], private: u32,
    }
    unsafe extern "system" fn procedure(window: Window, message: u32, wparam: usize, lparam: isize) -> isize {
        if message == 2 { PostQuitMessage(0); }
        DefWindowProcW(window, message, wparam, lparam)
    }
    struct Fixture { handle: Window, thread: Option<thread::JoinHandle<()>> }
    impl Fixture {
        fn create(class: &str, ex: u32, owner: Window) -> Self {
            let class = class.to_owned();
            let (send, receive) = std::sync::mpsc::channel();
            let thread = thread::spawn(move || {
                let class: Vec<u16> = class.encode_utf16().chain(Some(0)).collect();
                let registration = WindowClass { style: 0, procedure, class_extra: 0, window_extra: 0,
                    instance: 0, icon: 0, cursor: 0, background: 0, menu: std::ptr::null(), name: class.as_ptr() };
                unsafe { RegisterClassW(&registration); }
                let window = unsafe { CreateWindowExW(ex, class.as_ptr(), class.as_ptr(), 0x00cf_0000,
                    40, 40, 320, 240, owner, 0, 0, std::ptr::null_mut()) };
                send.send(window).unwrap();
                assert_ne!(window, 0, "fixture window creation failed");
                let mut message: Message = unsafe { std::mem::zeroed() };
                while unsafe { GetMessageW(&mut message, 0, 0, 0) } > 0 {
                    unsafe { TranslateMessage(&message); DispatchMessageW(&message); }
                }
            });
            let handle = receive.recv_timeout(Duration::from_secs(5)).unwrap();
            assert_ne!(handle, 0, "fixture window creation failed");
            Self { handle, thread: Some(thread) }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            unsafe { PostMessageW(self.handle, 0x10, 0, 0); }
            if let Some(thread) = self.thread.take() { thread.join().unwrap(); }
        }
    }

    #[test]
    fn restores_hidden_and_minimized_windows_and_keeps_maximized_size() {
        let _guard = WINDOWS.lock().unwrap();
        let window = Fixture::create("Chrome_WidgetWin_1", 0, 0);
        assert_eq!(unsafe { IsWindowVisible(window.handle) }, 0);
        restore_verified(std::process::id(), || true).unwrap();
        assert_ne!(unsafe { IsWindowVisible(window.handle) }, 0);
        unsafe { ShowWindow(window.handle, 6); }
        assert_ne!(unsafe { IsIconic(window.handle) }, 0);
        restore_verified(std::process::id(), || true).unwrap();
        assert_eq!(unsafe { IsIconic(window.handle) }, 0);
        unsafe { ShowWindow(window.handle, 3); }
        restore_verified(std::process::id(), || true).unwrap();
        assert_ne!(unsafe { IsZoomed(window.handle) }, 0);
    }

    #[test]
    fn rejects_ambiguity_and_ownership_changes_without_showing_windows() {
        let _guard = WINDOWS.lock().unwrap();
        let first = Fixture::create("Chrome_WidgetWin_1", 0, 0);
        let second = Fixture::create("Chrome_WidgetWin_1", 0, 0);
        assert!(restore_verified(std::process::id(), || true).is_err());
        assert_eq!(unsafe { IsWindowVisible(first.handle) }, 0);
        assert_eq!(unsafe { IsWindowVisible(second.handle) }, 0);
        drop(second);
        let reads = std::cell::Cell::new(0);
        assert!(restore_verified(std::process::id(), || { reads.set(reads.get() + 1); reads.get() == 1 }).is_err());
        assert_eq!(unsafe { IsWindowVisible(first.handle) }, 0);
        assert!(restore_verified(std::process::id().wrapping_add(1), || true).is_err());
        assert_eq!(unsafe { IsWindowVisible(first.handle) }, 0);
    }

    #[test]
    fn ignores_tool_owned_and_auxiliary_windows() {
        let _guard = WINDOWS.lock().unwrap();
        let main = Fixture::create("Chrome_WidgetWin_1", 0, 0);
        let tool = Fixture::create("Chrome_WidgetWin_1", WS_EX_TOOLWINDOW, 0);
        let owned = Fixture::create("Chrome_WidgetWin_1", 0, main.handle);
        let helper = Fixture::create("Chrome_WidgetWin_0", 0, 0);
        let inactive = Fixture::create("Chrome_WidgetWin_1", WS_EX_NOACTIVATE, 0);
        assert_eq!(unique_main(std::process::id()).unwrap().handle, main.handle);
        restore_verified(std::process::id(), || true).unwrap();
        assert_ne!(unsafe { IsWindowVisible(main.handle) }, 0);
        for other in [&tool, &owned, &helper, &inactive] { assert_eq!(unsafe { IsWindowVisible(other.handle) }, 0); }
    }
}
