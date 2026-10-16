//! Canonical Node identity includes forked children and group cleanup releases memory.

use std::fs;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};
use mokly_sidecar::process_memory::{MemoryFactory, SystemMemory};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

#[test]
fn symlinked_node_counts_children_and_recycle_releases_the_tree() {
    let temporary = tempfile::tempdir().unwrap();
    let node = Command::new("node")
        .args(["-p", "process.execPath"])
        .output()
        .unwrap();
    assert!(node.status.success());
    let executable = String::from_utf8(node.stdout).unwrap();
    let alias = temporary
        .path()
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    #[cfg(unix)]
    std::os::unix::fs::symlink(executable.trim(), &alias).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(executable.trim(), &alias).unwrap();
    let script = temporary.path().join("tree.cjs");
    fs::write(
        &script,
        r#"
const {fork} = require('node:child_process');
if (process.argv[2] === 'child') {
  global.memory = Buffer.alloc(32 * 1024 * 1024, 1);
  process.send(process.pid);
  setInterval(() => {}, 1000);
} else {
  const child = fork(__filename, ['child'], {stdio:['ignore','ignore','inherit','ipc']});
  child.once('message', pid => console.log(pid));
}
"#,
    )
    .unwrap();
    let groups: &dyn ProcessGroups = &SystemProcessGroups;
    for _ in 0..2 {
        let mut command = Command::new(&alias);
        command.arg(&script).stdout(Stdio::piped());
        groups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let group = groups.attach(&child).unwrap();
        let mut line = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let descendant: u32 = line.trim().parse().unwrap();
        let monitor = SystemMemory.monitor(child.id());
        let mut table = System::new();
        table.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from_u32(child.id())]),
            true,
            ProcessRefreshKind::nothing().with_memory().without_tasks(),
        );
        let root_bytes = table.process(Pid::from_u32(child.id())).unwrap().memory();
        let sum = monitor.resident_bytes(true).unwrap();
        group.kill().unwrap();
        child.wait().unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        let descendant_memory = SystemMemory.monitor(descendant);
        while descendant_memory.resident_bytes(false).unwrap() != 0 && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(
            root_bytes > 0 && sum > root_bytes,
            "root {root_bytes}, tree {sum}"
        );
        assert_eq!(descendant_memory.resident_bytes(false).unwrap(), 0);
        assert_eq!(monitor.resident_bytes(true).unwrap(), 0);
    }
}
