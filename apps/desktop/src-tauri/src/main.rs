#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ready;

use rand::{distributions::Alphanumeric, Rng};
use std::{
    fs,
    process::{Child, Command},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent};

struct Companion {
    child: Mutex<Option<Child>>,
    bridge_key: String,
}

impl Drop for Companion {
    fn drop(&mut self) {
        if let Ok(mut state) = self.child.lock() {
            if let Some(mut child) = state.take() {
                stop_child(&mut child, &self.bridge_key);
            }
        }
    }
}

// Fresh Windows profiles may spend 10–16 seconds creating DPAPI-backed state.
// Keep each loopback attempt short, but avoid killing a healthy first launch.
const READY_TIMEOUT: Duration = Duration::from_secs(30);
const READY_POLL: Duration = Duration::from_millis(150);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

fn diagnostic_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let data = std::env::var_os("APPDATA")
        .map(std::path::PathBuf::from)
        .map(|path| path.join("CodexTaskboard"))
        .unwrap_or(app.path().app_data_dir().map_err(|e| e.to_string())?);
    Ok(data.join("launcher-diagnostic.txt"))
}

fn record_startup_failure(app: &tauri::AppHandle, message: &str) {
    if let Ok(path) = diagnostic_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, message);
    }
    eprintln!("Taskboard launcher: {message}");
}

#[cfg(windows)]
fn show_startup_failure(message: &str) {
    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(window: isize, text: *const u16, caption: *const u16, kind: u32) -> i32;
    }
    let text: Vec<u16> =
        format!("{message}\n\n详细诊断：%APPDATA%\\CodexTaskboard\\launcher-diagnostic.txt")
            .encode_utf16()
            .chain(Some(0))
            .collect();
    let title: Vec<u16> = "Codex Taskboard 无法启动"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    unsafe {
        MessageBoxW(0, text.as_ptr(), title.as_ptr(), 0x10);
    }
}

#[cfg(not(windows))]
fn show_startup_failure(_message: &str) {}

fn start_companion(app: &tauri::AppHandle, bridge_key: &str) -> Result<Child, String> {
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let node = resources.join("runtime").join("node.exe");
    let entry = resources.join("runtime").join("companion.js");
    if !node.is_file() || !entry.is_file() {
        return Err(
            "Taskboard companion runtime is missing; reinstall this per-user application.".into(),
        );
    }
    let mut command = Command::new(node);
    let canonical_data = std::env::var_os("APPDATA")
        .map(std::path::PathBuf::from)
        .map(|path| path.join("CodexTaskboard"))
        .unwrap_or(app.path().app_data_dir().map_err(|e| e.to_string())?);
    command
        .arg(entry)
        .env("TASKBOARD_DATA_DIR", canonical_data)
        .env("TASKBOARD_CLIENT_KEY", bridge_key)
        .env("TASKBOARD_RUNTIME_COMPANION", "1");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map_err(|e| format!("Could not start companion: {e}"))
}

fn stop_child(child: &mut Child, bridge_key: &str) {
    let _ = ready::request_shutdown(bridge_key, Duration::from_millis(500));
    let deadline = Instant::now() + SHUTDOWN_TIMEOUT;
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => break,
        }
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn await_companion_ready(child: &mut Child, bridge_key: &str) -> Result<(), String> {
    let deadline = Instant::now() + READY_TIMEOUT;
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("cannot inspect companion process: {error}"))?
        {
            return Err(format!(
                "伴随服务在就绪前退出（{status}）。端口 47831 可能已被占用，或运行时损坏。"
            ));
        }
        match ready::probe_health(bridge_key, Duration::from_millis(250)) {
            Ok(true) => return Ok(()),
            Ok(false) => {}
            Err(error) => return Err(format!("伴随服务健康检查失败：{error}")),
        }
        if Instant::now() >= deadline {
            return Err("等待本机伴随服务就绪超时（30 秒）。端口 47831 可能已被占用。".into());
        }
        thread::sleep(READY_POLL);
    }
}

#[tauri::command]
fn bridge_capability(state: tauri::State<'_, Companion>) -> String {
    state.bridge_key.clone()
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app)
        }))
        .manage(Companion {
            child: Mutex::new(None),
            bridge_key: rand::thread_rng()
                .sample_iter(&Alphanumeric)
                .take(48)
                .map(char::from)
                .collect(),
        })
        .setup(|app| {
            let key = app.state::<Companion>().bridge_key.clone();
            let mut child = match start_companion(&app.handle(), &key) {
                Ok(child) => child,
                Err(error) => {
                    record_startup_failure(&app.handle(), &error);
                    show_startup_failure(&error);
                    return Err(error.into());
                }
            };
            if let Err(error) = await_companion_ready(&mut child, &key) {
                stop_child(&mut child, &key);
                record_startup_failure(&app.handle(), &error);
                show_startup_failure(&error);
                return Err(error.into());
            }
            *app.state::<Companion>()
                .child
                .lock()
                .map_err(|_| "companion lock poisoned")? = Some(child);
            let diagnostic = diagnostic_path(&app.handle())?;
            let _ = fs::remove_file(diagnostic);
            let open = MenuItem::with_id(app, "open", "打开任务看板", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = app
                .default_window_icon()
                .ok_or("Taskboard application icon is missing")?
                .clone();
            TrayIconBuilder::with_id("taskboard-tray")
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            show_main(&app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().ok();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![bridge_capability])
        .build(tauri::generate_context!())
        .expect("error while running Codex Taskboard")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Ok(mut state) = app.state::<Companion>().child.lock() {
                    if let Some(mut child) = state.take() {
                        stop_child(&mut child, &app.state::<Companion>().bridge_key);
                    }
                }
            }
        });
}
