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

/// One process below a root process.
#[derive(Clone, Debug)]
pub struct TreeProcess {
    /// The process id.
    pub pid: u32,
    /// The process group id.
    pub pgid: u32,
    /// The command line.
    pub command: String,
}

/// Every descendant of `root`, from `ps`.
pub fn descendants(root: u32) -> Vec<TreeProcess> {
    let output = Command::new("ps")
        .args(["-A", "-o", "pid=,ppid=,pgid=,args="])
        .output()
        .expect("ps starts");
    let rows: Vec<(u32, u32, u32, String)> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let pid = fields.next()?.parse().ok()?;
            let parent = fields.next()?.parse().ok()?;
            let group = fields.next()?.parse().ok()?;
            Some((pid, parent, group, fields.collect::<Vec<_>>().join(" ")))
        })
        .collect();
    let mut found = Vec::new();
    let mut parents = vec![root];
    while let Some(parent) = parents.pop() {
        for (pid, ppid, pgid, command) in &rows {
            if *ppid == parent {
                parents.push(*pid);
                found.push(TreeProcess {
                    pid: *pid,
                    pgid: *pgid,
                    command: command.clone(),
                });
            }
        }
    }
    found
}
