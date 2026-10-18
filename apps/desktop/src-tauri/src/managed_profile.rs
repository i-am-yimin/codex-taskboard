//! Persistent, Taskboard-owned Codex data. Process/session ownership is separate.
use rand::{distributions::Alphanumeric, Rng};
use serde_json::{json, Value};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}};

const MANIFEST: &str = "profile.json";
const MAX_MANIFEST: u64 = 4096;

pub struct ManagedProfile {
    pub profile: PathBuf,
    pub codex_home: PathBuf,
}

/// Keep one registered directory across ordinary restarts. Never inspect or
/// copy authentication files, and never fall back to another existing profile.
/// The caller must first rule out a live or unconfirmed previous launch.
pub fn prepare(managed_root: &Path) -> Result<ManagedProfile, String> {
    canonical_directory(managed_root)?;
    let manifest = managed_root.join(MANIFEST);
    if manifest.try_exists().map_err(|e| e.to_string())? {
        return read(managed_root);
    }
    let directory: String = rand::thread_rng().sample_iter(&Alphanumeric).take(24)
        .map(char::from).collect();
    let root = managed_root.join(&directory);
    fs::create_dir(&root).map_err(|e| e.to_string())?;
    fs::create_dir(root.join("profile")).map_err(|e| e.to_string())?;
    fs::create_dir(root.join("codex-home")).map_err(|e| e.to_string())?;
    let mut file = fs::OpenOptions::new().create_new(true).write(true).open(&manifest)
        .map_err(|e| format!("无法登记独立 Codex 目录；已保留数据，请先核对：{e}"))?;
    // A partial/corrupt record fails closed on the next attempt. Do not replace
    // it or silently create a fresh login environment after an interrupted write.
    file.write_all(json!({"version": 1, "directory": directory}).to_string().as_bytes())
        .and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    read(managed_root)
}

pub fn verify(managed_root: &Path, profile: &Path, codex_home: &Path) -> Result<(), String> {
    let registered = read(managed_root)?;
    if registered.profile != profile || registered.codex_home != codex_home {
        return Err("隔离启动目录与已登记的独立 Codex 目录不符".into());
    }
    Ok(())
}

fn read(managed_root: &Path) -> Result<ManagedProfile, String> {
    canonical_directory(managed_root)?;
    let manifest = managed_root.join(MANIFEST);
    let metadata = fs::symlink_metadata(&manifest).map_err(|e| e.to_string())?;
    if !metadata.is_file() || is_link(&metadata) || metadata.len() > MAX_MANIFEST {
        return Err("独立 Codex 目录记录无效；已保留数据，请先核对".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(&manifest).map_err(|e| e.to_string())?.take(MAX_MANIFEST + 1)
        .read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "独立 Codex 目录记录损坏；已保留数据，请先核对".to_string())?;
    let directory = value["directory"].as_str().ok_or("独立 Codex 目录记录缺少目录")?;
    if bytes.len() as u64 > MAX_MANIFEST || value["version"] != 1
        || directory.len() != 24 || !directory.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return Err("独立 Codex 目录记录不受支持；已保留数据，请先核对".into());
    }
    let root = managed_root.join(directory);
    canonical_directory(&root)?;
    let result = ManagedProfile {
        profile: root.join("profile"), codex_home: root.join("codex-home"),
    };
    canonical_directory(&result.profile)?;
    canonical_directory(&result.codex_home)?;
    Ok(result)
}

fn canonical_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_dir() || is_link(&metadata)
        || fs::canonicalize(path).map_err(|e| e.to_string())? != path {
        return Err("独立 Codex 目录必须是登记范围内的真实目录".into());
    }
    Ok(())
}

fn is_link(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("taskboard-profile-{}", rand::random::<u64>()));
            fs::create_dir(&root).unwrap();
            Self(fs::canonicalize(root).unwrap())
        }
        fn manifest(&self) -> PathBuf { self.0.join(MANIFEST) }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
            assert_eq!(self.0.parent(), Some(temp.as_path()));
            assert!(self.0.file_name().unwrap().to_string_lossy().starts_with("taskboard-profile-"));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn restarts_reuse_both_directories_without_touching_saved_state() {
        let fixture = Fixture::new();
        let first = prepare(&fixture.0).unwrap();
        fs::write(first.profile.join("saved-preferences"), b"opaque profile state").unwrap();
        fs::write(first.codex_home.join("saved-project"), b"opaque project state").unwrap();
        let manifest = fs::read(fixture.manifest()).unwrap();
        for _ in 0..3 {
            let next = prepare(&fixture.0).unwrap();
            assert_eq!(next.profile, first.profile);
            assert_eq!(next.codex_home, first.codex_home);
            assert_eq!(fs::read(next.profile.join("saved-preferences")).unwrap(), b"opaque profile state");
            assert_eq!(fs::read(next.codex_home.join("saved-project")).unwrap(), b"opaque project state");
            assert_eq!(fs::read(fixture.manifest()).unwrap(), manifest);
            verify(&fixture.0, &next.profile, &next.codex_home).unwrap();
        }
        let other = Fixture::new();
        let independent = prepare(&other.0).unwrap();
        assert_ne!(independent.profile, first.profile);
        assert!(verify(&other.0, &first.profile, &first.codex_home).is_err());
        assert!(verify(&fixture.0, &first.codex_home, &first.profile).is_err());
    }

    #[test]
    fn legacy_directories_are_preserved_and_only_explicit_registration_is_reused() {
        let fixture = Fixture::new();
        let legacy = fixture.0.join("A".repeat(24));
        fs::create_dir(&legacy).unwrap();
        fs::create_dir(legacy.join("profile")).unwrap();
        fs::create_dir(legacy.join("codex-home")).unwrap();
        fs::write(legacy.join("profile/sentinel"), b"legacy state").unwrap();
        let selected = prepare(&fixture.0).unwrap();
        assert_ne!(selected.profile, legacy.join("profile"));
        assert_eq!(fs::read(legacy.join("profile/sentinel")).unwrap(), b"legacy state");
        // Migration is explicit and uses a relative, bounded directory; it does
        // not search for accounts or copy data from the main Codex installation.
        fs::write(fixture.manifest(), json!({"version":1,"directory":"A".repeat(24)}).to_string()).unwrap();
        let migrated = prepare(&fixture.0).unwrap();
        assert_eq!(migrated.profile, legacy.join("profile"));
        assert_eq!(fs::read(migrated.profile.join("sentinel")).unwrap(), b"legacy state");
    }

    #[test]
    fn damaged_or_untrusted_registration_never_resets_the_login_environment() {
        let fixture = Fixture::new();
        let saved = prepare(&fixture.0).unwrap();
        let original = fs::read(fixture.manifest()).unwrap();
        for value in [
            "{".to_string(), "x".repeat(4097),
            json!({"version":2,"directory":"A".repeat(24)}).to_string(),
            json!({"version":1,"directory":".."}).to_string(),
            json!({"version":1,"directory":"../outside"}).to_string(),
            json!({"version":1,"directory":"C:/Users/main"}).to_string(),
            json!({"version":1,"directory":"A".repeat(24)}).to_string(),
        ] {
            fs::write(fixture.manifest(), &value).unwrap();
            let before = fs::read_dir(&fixture.0).unwrap().count();
            assert!(prepare(&fixture.0).is_err());
            assert_eq!(fs::read(fixture.manifest()).unwrap(), value.as_bytes());
            assert_eq!(fs::read_dir(&fixture.0).unwrap().count(), before);
        }
        fs::write(fixture.manifest(), original).unwrap();
        fs::remove_dir(&saved.codex_home).unwrap();
        assert!(prepare(&fixture.0).is_err());
        assert!(!saved.codex_home.exists());
    }

    #[test]
    fn registered_directory_cannot_be_redirected_through_a_junction() {
        use std::{os::windows::process::CommandExt, process::{Command, Stdio}};
        let fixture = Fixture::new();
        let outside = Fixture::new();
        let redirected = fixture.0.join("J".repeat(24));
        fs::create_dir(outside.0.join("profile")).unwrap();
        fs::create_dir(outside.0.join("codex-home")).unwrap();
        let status = Command::new("cmd.exe").args(["/d", "/c", "mklink", "/J"])
            .arg(&redirected).arg(&outside.0).creation_flags(0x08000000)
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status().unwrap();
        assert!(status.success());
        fs::write(fixture.manifest(), json!({"version":1,"directory":"J".repeat(24)}).to_string()).unwrap();
        assert!(prepare(&fixture.0).is_err());
        fs::remove_dir(&redirected).unwrap();
    }
}
