//! Temporary ancestry scans and a persistent table containing only owned processes.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::memory_tree::{Sample, descendants};

#[cfg_attr(test, unimock::unimock(api = [DiscoverMock, RefreshMock, CanonicalizeMock]))]
pub(crate) trait ProcessTable: Send {
    fn discover(&self, root: u32) -> Vec<u32>;
    fn refresh(&mut self, pids: &[u32]) -> BTreeMap<u32, Sample>;
    fn canonicalize(&self, path: &Path) -> Option<PathBuf>;
}

pub(crate) struct SystemTable(pub(crate) System);
impl ProcessTable for SystemTable {
    fn discover(&self, root: u32) -> Vec<u32> {
        let mut parents = System::new();
        parents.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().without_tasks(),
        );
        let records = parents
            .processes()
            .iter()
            .map(|(pid, process)| {
                (
                    pid.as_u32(),
                    Sample {
                        parent: process.parent().map(Pid::as_u32),
                        bytes: 0,
                        executable: None,
                        started: 0,
                    },
                )
            })
            .collect();
        descendants(root, &records).into_iter().collect()
    }
    fn refresh(&mut self, pids: &[u32]) -> BTreeMap<u32, Sample> {
        let selected: Vec<_> = pids.iter().map(|pid| Pid::from_u32(*pid)).collect();
        if self.0.processes().keys().any(|pid| !selected.contains(pid)) {
            self.0 = System::new();
        }
        self.0.refresh_processes_specifics(
            ProcessesToUpdate::Some(&selected),
            true,
            ProcessRefreshKind::nothing()
                .with_memory()
                .with_exe(UpdateKind::OnlyIfNotSet)
                .without_tasks(),
        );
        selected
            .iter()
            .filter_map(|pid| {
                self.0
                    .process(*pid)
                    .map(|process| (pid.as_u32(), sample(process)))
            })
            .collect()
    }
    fn canonicalize(&self, path: &Path) -> Option<PathBuf> {
        fs::canonicalize(path).ok()
    }
}

fn sample(process: &Process) -> Sample {
    Sample {
        parent: process.parent().map(Pid::as_u32),
        bytes: process.memory(),
        executable: process
            .exe()
            .filter(|path| !path.as_os_str().is_empty())
            .map(Path::to_owned),
        started: process.start_time(),
    }
}
