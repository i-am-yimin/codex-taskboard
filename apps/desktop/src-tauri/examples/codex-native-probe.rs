//! Developer acceptance probe; not included in the installer.
//! Holds the real child handle until Codex is closed and exposes the same
//! authenticated native ownership check used by the companion.

#![cfg_attr(windows, windows_subsystem = "windows")]

#[cfg(windows)]
#[path = "../src/managed_codex.rs"]
mod managed_codex;
#[cfg(windows)]
#[path = "../src/owned_process.rs"]
mod owned_process;
#[cfg(windows)]
#[path = "../src/package_launch.rs"]
mod package_launch;
#[cfg(windows)]
#[path = "../src/private_pipe.rs"]
mod private_pipe;

#[cfg(windows)]
fn run(root: &std::path::Path) -> Result<(), String> {
    use rand::{distributions::Alphanumeric, Rng};
    use std::{fs, sync::{Arc, Mutex}, thread, time::Duration};
    let mut child = managed_codex::launch_probe(root)?;
    child.await_binding()?;
    let evidence = child.probe_description();
    if evidence["valid"] != true {
        return Err("Native ownership verification failed; the isolated child is left intact".into());
    }
    fs::write(root.join("native.json"), serde_json::to_vec_pretty(&evidence).unwrap())
        .map_err(|error| error.to_string())?;
    let key: String = rand::thread_rng().sample_iter(&Alphanumeric).take(48).map(char::from).collect();
    let state = Arc::new(Mutex::new(Some(child)));
    let port = managed_codex::start_control(state.clone(), key.clone())?;
    // Ephemeral local capability: never publish or paste this file.
    fs::write(root.join("control.json"), serde_json::to_vec(&serde_json::json!({
        "port": port, "key": key
    })).unwrap()).map_err(|error| error.to_string())?;
    println!("Native binding verified. Evidence: {}", root.join("native.json").display());
    println!("Keep this probe running for host acceptance. Close the isolated Codex window to finish.");
    loop {
        let running = state.lock().map_err(|_| "Native ownership lock poisoned")?
            .as_mut().is_some_and(|child| child.is_running());
        if !running { break; }
        thread::sleep(Duration::from_millis(500));
    }
    fs::write(root.join("closed.json"), b"{\"childExited\":true}")
        .map_err(|error| error.to_string())?;
    fs::remove_file(root.join("control.json")).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn main() {
    if let Some(code) = package_launch::dispatch_helper() {
        std::process::exit(code);
    }
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 1 {
        eprintln!("Usage: codex-native-probe.exe <new absolute acceptance directory>");
        std::process::exit(2);
    }
    let root = std::path::PathBuf::from(&args[0]);
    // An exclusive fresh directory prevents attaching to existing user sessions.
    if !root.is_absolute() || std::fs::create_dir(&root).is_err() {
        eprintln!("The acceptance directory must be absolute, new, and have an existing parent");
        std::process::exit(2);
    }
    if let Err(error) = run(&root) {
        let _ = std::fs::write(root.join("error.json"), serde_json::to_vec_pretty(
            &serde_json::json!({"error": error})
        ).unwrap());
        eprintln!("Native acceptance failed: {error}");
        std::process::exit(1);
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("Native Codex acceptance requires Windows");
    std::process::exit(2);
}
