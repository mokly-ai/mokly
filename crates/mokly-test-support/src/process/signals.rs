//! Send Unix signals with the `kill` command.

use std::process::{Command, Stdio};

/// Send the signal `name`, such as `INT`, to every process in the group `group`.
pub fn signal_group(group: u32, name: &str) {
    let status = Command::new("kill")
        .args(["-s", name, "--", &format!("-{group}")])
        .status()
        .expect("kill starts");
    assert!(status.success(), "kill -s {name} -- -{group} failed");
}

/// Whether the process `pid` still exists.
pub fn alive(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stderr(Stdio::null())
        .status()
        .expect("kill starts")
        .success()
}

/// Send the signal `name`, such as `INT`, to the process `pid`.
pub fn signal(pid: u32, name: &str) {
    let status = Command::new("kill")
        .args(["-s", name, &pid.to_string()])
        .status()
        .expect("kill starts");
    assert!(status.success(), "kill -s {name} {pid} failed");
}
