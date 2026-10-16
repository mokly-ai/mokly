//! One persistent host process table per worker; executable IO has an injectable boundary.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::memory_tree::Sample;

#[cfg_attr(test, unimock::unimock(api = [RefreshMock, CanonicalizeMock]))]
pub(crate) trait ProcessTable: Send {
    fn refresh(&mut self, pids: Option<&[u32]>) -> BTreeMap<u32, Sample>;
    fn canonicalize(&self, path: &Path) -> Option<PathBuf>;
}

pub(crate) struct SystemTable(pub(crate) System);
impl ProcessTable for SystemTable {
    fn refresh(&mut self, pids: Option<&[u32]>) -> BTreeMap<u32, Sample> {
        let selected: Vec<_> = pids
            .unwrap_or_default()
            .iter()
            .map(|pid| Pid::from_u32(*pid))
            .collect();
        self.0.refresh_processes_specifics(
            if pids.is_some() {
                ProcessesToUpdate::Some(&selected)
            } else {
                ProcessesToUpdate::All
            },
            true,
            ProcessRefreshKind::nothing()
                .with_memory()
                .with_exe(UpdateKind::OnlyIfNotSet)
                .without_tasks(),
        );
        match pids {
            Some(_) => selected
                .iter()
                .filter_map(|pid| {
                    self.0
                        .process(*pid)
                        .map(|process| (pid.as_u32(), sample(process)))
                })
                .collect(),
            None => self
                .0
                .processes()
                .iter()
                .map(|(pid, process)| (pid.as_u32(), sample(process)))
                .collect(),
        }
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
