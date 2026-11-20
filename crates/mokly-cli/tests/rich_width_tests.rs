//! Forced-rich output uses stdout's width independently of the other streams.

#![cfg(unix)]

use std::fs::File;
use std::io::Read;
use std::os::fd::FromRawFd;
use std::process::{Command, Stdio};
use std::ptr;

#[derive(Clone, Copy, Debug)]
enum TerminalStream {
    Stderr,
    Stdin,
}

fn terminal(columns: u16) -> (File, File) {
    let mut master = -1;
    let mut slave = -1;
    let mut size = libc::winsize {
        ws_row: 24,
        ws_col: columns,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    // SAFETY: openpty initializes two descriptor slots and reads the live size value.
    let result = unsafe {
        libc::openpty(
            &mut master,
            &mut slave,
            ptr::null_mut(),
            ptr::null_mut(),
            &raw mut size,
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
    // SAFETY: successful openpty creates two distinct owned file descriptors.
    unsafe { (File::from_raw_fd(master), File::from_raw_fd(slave)) }
}

/// A closed PTY returns EOF on macOS or EIO on Linux.
fn terminal_output(mut master: File) -> Vec<u8> {
    let mut bytes = Vec::new();
    let result = master.read_to_end(&mut bytes);
    assert!(
        result.is_ok() || result.unwrap_err().raw_os_error() == Some(libc::EIO),
        "failed to read the terminal output"
    );
    bytes
}

fn rich_failure(stream: TerminalStream) -> String {
    let (master, slave) = terminal(32);
    let (input, error) = match stream {
        TerminalStream::Stderr => (Stdio::null(), Stdio::from(slave)),
        TerminalStream::Stdin => (Stdio::from(slave), Stdio::piped()),
    };
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .arg("x".repeat(100))
        .env_clear()
        .env("MOKLY_OUTPUT", "rich")
        .env("NO_COLOR", "1")
        .stdin(input)
        .stdout(Stdio::piped())
        .stderr(error)
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1), "{stream:?}");
    assert!(output.stdout.is_empty(), "{stream:?}");
    let bytes = match stream {
        TerminalStream::Stderr => terminal_output(master),
        TerminalStream::Stdin => output.stderr,
    };
    String::from_utf8(bytes).unwrap()
}

#[test]
fn forced_rich_pipe_uses_80_columns_when_another_stream_is_a_terminal() {
    let headlines = [TerminalStream::Stderr, TerminalStream::Stdin].map(|stream| {
        let error = rich_failure(stream);
        error.lines().next().unwrap().to_owned()
    });
    let expected = concat!(
        "✖ Unknown command \"",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "…"
    );
    assert_eq!(headlines, [expected, expected]);
}
