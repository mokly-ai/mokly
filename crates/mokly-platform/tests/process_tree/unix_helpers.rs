//! Re-exec roles create sessions without a platform-specific setsid command.

use std::env;
use std::io::BufReader;
use std::process::{self, Stdio};

use super::fixture::{helper, read_ready, report};

/// Run one helper role only when the parent test supplied its environment.
pub(crate) fn run_helper() {
    let Ok(role) = env::var("MOKLY_TREE_ROLE") else {
        return;
    };
    let mode = env::var("MOKLY_TREE_MODE").unwrap();
    match role.as_str() {
        "manager" => {
            let mut session = helper("session", &mode)
                .stdout(Stdio::piped())
                .spawn()
                .unwrap();
            let pids = read_ready(BufReader::new(session.stdout.take().unwrap()));
            if mode == "orphan" {
                session.wait().unwrap();
            }
            report(&pids);
            session.wait().unwrap();
        }
        "session" => {
            new_session();
            if mode == "ignore" {
                ignore_term();
            }
            let mut leaf = helper("leaf", &mode)
                .stdout(Stdio::piped())
                .spawn()
                .unwrap();
            let pids = read_ready(BufReader::new(leaf.stdout.take().unwrap()));
            report(&[process::id() as i32, pids[0]]);
            if mode == "orphan" {
                process::exit(0);
            }
            leaf.wait().unwrap();
        }
        "leaf" => {
            new_session();
            ignore_term();
            report(&[process::id() as i32]);
        }
        _ => panic!("unknown helper role: {role}"),
    }
    loop {
        std::thread::park();
    }
}

fn new_session() {
    // SAFETY: The helper is not its parent's process-group leader. setsid
    // changes only this isolated helper's session and accesses no memory.
    assert!(unsafe { libc::setsid() } >= 0);
}

fn ignore_term() {
    // SAFETY: SIG_IGN changes only this isolated helper's SIGTERM disposition.
    assert_ne!(
        unsafe { libc::signal(libc::SIGTERM, libc::SIG_IGN) },
        libc::SIG_ERR
    );
}
