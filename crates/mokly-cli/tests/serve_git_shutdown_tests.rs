//! Serve drains a real Git process group even when its members ignore SIGTERM.

#![cfg(unix)]

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

async fn marker(path: &Path) -> String {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            if let Ok(value) = fs::read_to_string(path)
                && !value.trim().is_empty()
            {
                return value.trim().into();
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap()
}

fn live(pid: &str) -> bool {
    fs::read_to_string(format!("/proc/{pid}/stat"))
        .ok()
        .is_some_and(|stat| !stat.rsplit_once(") ").unwrap().1.starts_with('Z'))
}

#[tokio::test]
async fn shutdown_kills_ignoring_git_and_its_pipe_holding_child_before_exit() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("bin")).unwrap();
    fs::write(
        root.path().join("mokly.config.json"),
        r#"{"repoRoot":".","roots":[{"dir":"specs"}]}"#,
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    )
    .unwrap();
    let git = root.path().join("bin/git");
    fs::write(&git, "#!/bin/sh\ntrap '' TERM\necho $$ > \"$MOKLY_GIT_TEST_PID\"\n/bin/sh -c 'trap \"\" TERM; echo $$ > \"$MOKLY_GIT_TEST_CHILD\"; while :; do /bin/sleep 1; done' &\nwait\n").unwrap();
    fs::set_permissions(&git, fs::Permissions::from_mode(0o755)).unwrap();
    let pid_file = root.path().join("git-pid");
    let child_file = root.path().join("child-pid");
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["serve", "--port", "0", "--no-watch"])
        .current_dir(root.path())
        .env("PATH", root.path().join("bin"))
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_GIT_TEST_PID", &pid_file)
        .env("MOKLY_GIT_TEST_CHILD", &child_file)
        .env(
            "MOKLY_VIEWER_DIST",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/viewer/dist"),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let line = tokio::time::timeout(
        Duration::from_secs(15),
        BufReader::new(stdout).lines().next_line(),
    )
    .await
    .unwrap()
    .unwrap()
    .unwrap();
    let url = line.strip_prefix("Mokly listening at ").unwrap();
    let git_pid = marker(&pid_file).await;
    let descendant = marker(&child_file).await;
    assert!(live(&git_pid));
    assert!(live(&descendant));
    assert!(
        std::process::Command::new("/bin/kill")
            .args(["-TERM", &child.id().unwrap().to_string()])
            .status()
            .unwrap()
            .success()
    );
    let output = tokio::time::timeout(Duration::from_secs(15), child.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!live(&git_pid));
    assert!(!live(&descendant));
    assert!(std::net::TcpListener::bind(url.strip_prefix("http://").unwrap()).is_ok());
    assert!(!String::from_utf8_lossy(&output.stderr).contains("Changes ready"));
}
