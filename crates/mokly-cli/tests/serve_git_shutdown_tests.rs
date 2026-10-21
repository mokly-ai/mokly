//! Serve drains a real Git process group even when its members ignore SIGTERM.

#![cfg(unix)]

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
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
    let output = std::process::Command::new("ps")
        .args(["-o", "stat=", "-p", pid])
        .output()
        .unwrap();
    assert!(matches!(output.status.code(), Some(0 | 1)), "{output:?}");
    active_state(&String::from_utf8(output.stdout).unwrap())
}

fn active_state(state: &str) -> bool {
    let state = state.trim();
    !state.is_empty() && !state.starts_with('Z')
}

#[test]
fn process_probe_distinguishes_live_absent_and_zombie_states() {
    for state in ["R", " S+\n", "Ss", "I"] {
        assert!(active_state(state), "{state}");
    }
    for state in ["", " \n", "Z", " Z+\n"] {
        assert!(!active_state(state), "{state}");
    }
}

#[test]
fn process_probe_recognizes_the_running_test_process() {
    assert!(live(&std::process::id().to_string()));
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
        .env("MOKLY_OUTPUT", "rich")
        .env("NO_COLOR", "1")
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
    let mut stdout = BufReader::new(child.stdout.take().unwrap());
    let mut prefix = String::new();
    let url = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let mut line = String::new();
            assert!(stdout.read_line(&mut line).await.unwrap() > 0);
            prefix.push_str(&line);
            if let Some(url) = line
                .split_whitespace()
                .find(|part| part.starts_with("http://127.0.0.1:"))
            {
                break url.to_owned();
            }
        }
    })
    .await
    .unwrap();
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
    let mut remaining = prefix;
    stdout.read_to_string(&mut remaining).await.unwrap();
    assert!(remaining.contains("Catalogue ready"), "{remaining}");
    assert!(!remaining.contains("Changes ready"), "{remaining}");
}
