//! Node process composition with inherited environment and whole-tree ownership.

use std::fs;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_platform::processes::ProcessGroups;

use crate::client::Client;
use crate::error::{Error, InternalError, Result};
use crate::pool_options::Launch;
use crate::process_clock::Wait;
use crate::process_control::ProcessControl;
use crate::process_io::{Reaper, read_diagnostics, read_frames, write_frames};
use crate::process_memory::MemoryFactory;
use crate::process_parent::{ParentSpawn, ParentSpawner};
use crate::process_transport::{Deadlines, PipeTransport};
use crate::process_worker::{ForwardEvents, ProcessWorker};
use crate::workers::{Diagnostics, Spawned, WorkerControl, WorkerFactory};

/// Concrete worker factory, assembled once by the executable composition root.
pub struct NodeFactory {
    parent: Arc<dyn ParentSpawn>,
    groups: Arc<dyn ProcessGroups>,
    clock: Arc<dyn Wait>,
    diagnostics: Arc<dyn Diagnostics>,
    memory: Arc<dyn MemoryFactory>,
}

impl NodeFactory {
    /// Inject host primitives, monotonic deadlines, and the terminal reporter.
    pub fn new(
        groups: Arc<dyn ProcessGroups>,
        clock: Arc<dyn Wait>,
        diagnostics: Arc<dyn Diagnostics>,
        memory: Arc<dyn MemoryFactory>,
    ) -> Self {
        Self {
            parent: Arc::new(ParentSpawner::default()),
            groups,
            clock,
            diagnostics,
            memory,
        }
    }
}

impl WorkerFactory for NodeFactory {
    fn spawn(&self, launch: &Launch) -> Result<Spawned> {
        if !matches!(fs::metadata(&launch.entry), Ok(metadata) if metadata.is_file()) {
            return Err(Error::Unavailable {
                part: launch.entry.display().to_string(),
            });
        }
        if !matches!(fs::metadata(&launch.repository), Ok(metadata) if metadata.is_dir()) {
            return Err(Error::Unavailable {
                part: launch.repository.display().to_string(),
            });
        }
        let repository = match dunce::canonicalize(&launch.repository) {
            Ok(repository) => repository,
            Err(_) => {
                return Err(Error::Unavailable {
                    part: launch.repository.display().to_string(),
                });
            }
        };
        let mut command = Command::new(&launch.node);
        command
            .arg(&launch.entry)
            .current_dir(&repository)
            .env("PWD", &repository)
            .env_remove("INIT_CWD")
            .env_remove("npm_package_json")
            .env_remove("npm_config_local_prefix")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Err(source) = self.groups.configure(&mut command) {
            return Err(InternalError::Platform { source }.into());
        }
        let mut child = match self.parent.spawn(command) {
            Ok(child) => Reaper(child),
            Err(_) => {
                return Err(Error::Unavailable {
                    part: launch.node.display().to_string(),
                });
            }
        };
        let group = match self.groups.attach(&child.0) {
            Ok(group) => group,
            Err(source) => return Err(InternalError::Platform { source }.into()),
        };
        let pid = child.0.id();
        let (Some(stdin), Some(stdout), Some(stderr)) = (
            child.0.stdin.take(),
            child.0.stdout.take(),
            child.0.stderr.take(),
        ) else {
            let _ = group.kill();
            return Err(InternalError::Synchronization.into());
        };
        let (outgoing, outgoing_frames) = mpsc::sync_channel(2);
        let (incoming_frames, incoming) = mpsc::sync_channel(2);
        let (exited_tx, exited) = mpsc::sync_channel(1);
        let control: Arc<dyn WorkerControl> = Arc::new(ProcessControl {
            group,
            outgoing: outgoing.clone(),
            exited: Mutex::new(exited),
            clock: Arc::clone(&self.clock),
        });
        let diagnostics = Arc::clone(&self.diagnostics);
        let tasks: Vec<Box<dyn FnOnce() + Send>> = vec![
            Box::new(move || write_frames(stdin, outgoing_frames)),
            Box::new(move || read_frames(stdout, incoming_frames)),
            Box::new(move || read_diagnostics(stderr, diagnostics)),
            Box::new(move || {
                child.wait();
                let _ = exited_tx.send(());
            }),
        ];
        for task in tasks {
            if let Err(source) = thread::Builder::new()
                .name("mokly-sidecar-pipe".to_owned())
                .spawn(task)
            {
                control.kill()?;
                return Err(InternalError::Io { source }.into());
            }
        }
        let deadlines = Arc::new(Deadlines {
            absolute: AtomicU64::new(0),
            duration: AtomicU64::new(0),
        });
        let transport = PipeTransport {
            outgoing,
            incoming,
            clock: Arc::clone(&self.clock),
            deadlines: Arc::clone(&deadlines),
        };
        let client = Client::new(
            Box::new(transport),
            Box::new(ForwardEvents(Arc::clone(&self.diagnostics))),
            launch.version.clone(),
        );
        Ok(Spawned {
            worker: Box::new(ProcessWorker {
                diagnostics: self.diagnostics.clone(),
                client: Box::new(client),
                clock: Arc::clone(&self.clock),
                memory: self.memory.monitor(pid),
                discover_memory: AtomicBool::new(false),
                deadlines,
            }),
            control,
        })
    }
}
