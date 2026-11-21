//! HTML fixture writes and complete native-process shutdown.

use std::fs;
use std::path::Path;
use std::time::Duration;

use tokio::io::AsyncReadExt;

use super::Running;

pub(super) fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

pub(super) async fn close(mut running: Running, signal: &str) -> (String, String) {
    let pid = running.child.id().unwrap().to_string();
    let mut request = std::process::Command::new("kill");
    request.arg(signal).arg(&pid);
    if signal == "-INT" {
        request.arg(&pid);
    }
    assert!(request.status().unwrap().success());
    let status = tokio::time::timeout(Duration::from_secs(15), running.child.wait())
        .await
        .unwrap()
        .unwrap();
    let mut stderr = running.prefix;
    running.errors.read_to_string(&mut stderr).await.unwrap();
    assert_eq!(status.code(), Some(0), "{stderr}");
    assert!(!running.root.path().join("mokly-static").exists());
    assert!(!running.root.path().join("mokly-generated").exists());
    (running.url, stderr)
}
