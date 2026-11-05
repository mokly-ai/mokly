//! A closed terminal disables shortcuts without keeping a signalled Serve alive.
//!
//! The incomplete escape sequence after `h` holds the legacy reader inside input
//! processing before the terminal closes.

#![cfg(unix)]

use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::os::fd::{AsRawFd, FromRawFd};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::ptr;
use std::time::Duration;

use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;

fn terminal() -> (File, File) {
    let mut master = -1;
    let mut slave = -1;
    // SAFETY: openpty initializes two descriptor slots. Null options select defaults.
    let result = unsafe {
        libc::openpty(
            &mut master,
            &mut slave,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
        )
    };
    assert_eq!(result, 0);
    for descriptor in [master, slave] {
        // SAFETY: both live descriptors belong to this fixture.
        assert_eq!(
            unsafe { libc::fcntl(descriptor, libc::F_SETFD, libc::FD_CLOEXEC) },
            0
        );
    }
    // SAFETY: successful openpty gives two distinct owned descriptors.
    unsafe { (File::from_raw_fd(master), File::from_raw_fd(slave)) }
}

fn fixture(root: &Path) {
    for (path, bytes) in [
        ("mokly.config.json", "{}"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        ),
        (
            "viewer/browser.manifest.json",
            r#"{"schemaVersion":1,"modules":["shell.js","frame-probe.js"]}"#,
        ),
        ("viewer/browser/shell.js", ""),
        ("viewer/browser/frame-probe.js", ""),
        ("viewer/shell.css", ""),
        ("viewer/assets/fonts/InterVariable.woff2", ""),
        ("viewer/assets/brand.svg", "<svg/>"),
    ] {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
}

fn available(input: &File) -> libc::c_int {
    let mut count: libc::c_int = 0;
    // SAFETY: the live terminal descriptor initializes one integer on success.
    let result = unsafe { libc::ioctl(input.as_raw_fd(), libc::FIONREAD, &mut count) };
    assert_eq!(result, 0);
    count
}

async fn consumed(input: &File) {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            if available(input) == 0 {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}

async fn get(host: &str) -> String {
    let mut socket = TcpStream::connect(host).await.unwrap();
    socket
        .write_all(
            format!("GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .await
        .unwrap();
    let mut response = String::new();
    socket.read_to_string(&mut response).await.unwrap();
    response
}

#[tokio::test]
async fn closed_terminal_keeps_serve_available_and_hangup_exits_zero() {
    for (access, mode) in [("readable path", 0o600), ("inherited descriptor only", 0)] {
        let root = TempDir::new().unwrap();
        fixture(root.path());
        let binary = env::var_os("MOKLY_TEST_TERMINAL_BINARY")
            .map(PathBuf::from)
            .unwrap_or_else(|| env!("CARGO_BIN_EXE_mokly").into());
        let (mut input, slave) = terminal();
        // SAFETY: the live slave descriptor belongs to this fixture.
        assert_eq!(
            unsafe { libc::fchmod(slave.as_raw_fd(), mode) },
            0,
            "{access}"
        );
        let probe = slave.try_clone().unwrap();
        let mut child = Command::new(binary)
            .args(["serve", "--port", "0"])
            .current_dir(root.path())
            .env("MOKLY_OUTPUT", "rich")
            .env("NO_COLOR", "1")
            .env("PATH", "")
            .env("MOKLY_VIEWER_DIST", root.path().join("viewer"))
            .env_remove("MOKLY_SIDECARS")
            .env_remove("CI")
            .stdin(Stdio::from(slave))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap()).lines();
        let host = tokio::time::timeout(Duration::from_secs(15), async {
            loop {
                let line = output.next_line().await.unwrap().unwrap();
                if let Some(host) = line
                    .split_whitespace()
                    .find_map(|part| part.strip_prefix("http://"))
                {
                    break host.to_owned();
                }
            }
        })
        .await
        .unwrap();
        input.write_all(b"h\x1b[").unwrap();
        let help = tokio::time::timeout(Duration::from_secs(15), async {
            loop {
                let line = output.next_line().await.unwrap().unwrap();
                if line.contains("Ctrl+C  Close Serve") {
                    break;
                }
            }
        })
        .await;
        assert!(
            help.is_ok(),
            "Serve did not answer h through inherited stdin: {access}"
        );
        consumed(&probe).await;
        drop(input);
        let response = tokio::time::timeout(Duration::from_secs(15), get(&host))
            .await
            .unwrap();
        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        let pid = child.id().unwrap() as libc::pid_t;
        // SAFETY: the PID belongs to this fixture's live child process.
        assert_eq!(unsafe { libc::kill(pid, libc::SIGHUP) }, 0);
        let exited = tokio::time::timeout(Duration::from_secs(15), child.wait()).await;
        assert!(
            exited.is_ok(),
            "Serve stayed alive after terminal close and SIGHUP"
        );
        let status = exited.unwrap().unwrap();
        let mut errors = String::new();
        child
            .stderr
            .take()
            .unwrap()
            .read_to_string(&mut errors)
            .await
            .unwrap();
        assert_eq!(status.code(), Some(0), "{errors}");
        assert!(std::net::TcpListener::bind(&host).is_ok());
    }
}
