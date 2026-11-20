//! Real descendant readiness, process-state observations, and failure-safe cleanup.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use mokly_sidecar::pool_options::Launch;
use sysinfo::{Pid, ProcessRefreshKind, ProcessStatus, ProcessesToUpdate, System};
use tempfile::TempDir;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum State {
    Live,
    Exited,
    Reaped,
}

pub(super) struct Tree {
    root: TempDir,
    pids: Mutex<Vec<u32>>,
}

impl Tree {
    pub(super) fn new() -> Self {
        Self {
            root: tempfile::tempdir().unwrap(),
            pids: Mutex::new(Vec::new()),
        }
    }

    pub(super) fn launch(&self) -> Launch {
        Launch {
            capture_durability: false,
            node: "node".into(),
            entry: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../tests/fixtures/sidecar/startup-tree.mjs"),
            repository: self.root.path().into(),
            version: "test".into(),
        }
    }

    pub(super) fn ready(&self, root: u32) {
        let path = self.root.path().join("startup-tree-ready");
        let deadline = Instant::now() + Duration::from_secs(10);
        while !path.is_file() && Instant::now() < deadline {
            thread::yield_now();
        }
        let text = fs::read_to_string(path).unwrap();
        let pids: Vec<u32> = text
            .split_whitespace()
            .map(|pid| pid.parse().unwrap())
            .collect();
        *self.pids.lock().unwrap() = pids.clone();
        assert_eq!(pids.len(), 2);
        assert_eq!(pids[0], root);
        assert_eq!(states(&pids), [State::Live, State::Live]);
        println!(
            "ready: direct_child={} descendant={} states={:?}",
            pids[0],
            pids[1],
            states(&pids)
        );
    }

    pub(super) fn assert_stopped(&self) {
        let pids = self.pids.lock().unwrap().clone();
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut observed = states(&pids);
        while (observed[0] != State::Reaped || observed[1] == State::Live)
            && Instant::now() < deadline
        {
            thread::yield_now();
            observed = states(&pids);
        }
        println!(
            "cleanup: direct_child={} descendant={} states={observed:?}",
            pids[0], pids[1]
        );
        assert_eq!(observed[0], State::Reaped, "direct child must be reaped");
        assert_ne!(
            observed[1],
            State::Live,
            "descendant must stop before failed startup returns"
        );
    }
}

fn table(pids: &[u32]) -> System {
    let mut table = System::new();
    let pids: Vec<_> = pids.iter().copied().map(Pid::from_u32).collect();
    table.refresh_processes_specifics(
        ProcessesToUpdate::Some(&pids),
        true,
        ProcessRefreshKind::nothing().without_tasks(),
    );
    table
}

fn states(pids: &[u32]) -> Vec<State> {
    let table = table(pids);
    pids.iter()
        .map(|pid| match table.process(Pid::from_u32(*pid)) {
            None => State::Reaped,
            Some(process)
                if matches!(
                    process.status(),
                    ProcessStatus::Zombie | ProcessStatus::Dead
                ) =>
            {
                State::Exited
            }
            Some(_) => State::Live,
        })
        .collect()
}

impl Drop for Tree {
    fn drop(&mut self) {
        let pids = self
            .pids
            .get_mut()
            .unwrap_or_else(|error| error.into_inner());
        let table = table(pids);
        for pid in pids.iter().rev() {
            if let Some(process) = table.process(Pid::from_u32(*pid)) {
                let _ = process.kill();
            }
        }
    }
}
