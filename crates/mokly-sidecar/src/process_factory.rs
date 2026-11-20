//! Node process composition with inherited environment and whole-tree ownership.

use std::fs;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex, mpsc};

use mokly_platform::processes::ProcessGroups;
use mokly_platform::volumes::{CaptureVolumes, SystemCaptureVolumes};

use crate::capture_hint::CaptureHint;
use crate::client::Client;
use crate::error::{Error, InternalError, Result};
use crate::pool_options::Launch;
use crate::postcss_phase::PhaseState;
use crate::process_clock::Wait;
use crate::process_completion::{ProcessCompletion, complete};
use crate::process_control::ProcessControl;
use crate::process_environment;
use crate::process_io::{read_diagnostics, read_frames, write_frames};
use crate::process_memory::MemoryFactory;
use crate::process_parent::{ParentSpawn, ParentSpawner};
use crate::process_reaper::Reaper;
use crate::process_startup::StartupTiming;
use crate::process_threads::{PipeThreads, SystemPipeThreads};
use crate::process_transport::{Deadlines, PipeTransport};
use crate::process_worker::{ForwardEvents, ProcessWorker};
use crate::workers::{Diagnostics, SpawnFailure, Spawned, WorkerControl, WorkerFactory};

/// Concrete worker factory, assembled once by the executable composition root.
pub struct NodeFactory {
    parent: Arc<dyn ParentSpawn>,
    groups: Arc<dyn ProcessGroups>,
    clock: Arc<dyn Wait>,
    diagnostics: Arc<dyn Diagnostics>,
    memory: Arc<dyn MemoryFactory>,
    timings: bool,
    volumes: Arc<dyn CaptureVolumes>,
    threads: Arc<dyn PipeThreads>,
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
            timings: false,
            volumes: Arc::new(SystemCaptureVolumes),
            threads: Arc::new(SystemPipeThreads),
        }
    }

    /// Enable sidecar timing records through hello and forward their stderr lines.
    pub fn with_timings(mut self, enabled: bool) -> Self {
        self.timings = enabled;
        self
    }

    /// Inject the host thread creation boundary for pipe startup.
    pub fn with_threads(mut self, threads: Arc<dyn PipeThreads>) -> Self {
        self.threads = threads;
        self
    }
}

impl NodeFactory {
    /// Prepare Node with the canonical source directory as its working
    /// directory and `PWD`. `dunce::canonicalize` avoids the Windows `\\?\` verbatim form
    /// that `std::fs::canonicalize` returns, which many Node tools do not handle.
    fn command(&self, launch: &Launch) -> Result<Command> {
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
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        process_environment::apply(
            &mut command,
            std::env::vars_os().map(|(name, _)| name),
            &repository,
            cfg!(windows),
        );
        if let Err(source) = self.groups.configure(&mut command) {
            return Err(InternalError::Platform { source }.into());
        }
        Ok(command)
    }

    fn spawn_owned(
        &self,
        launch: &Launch,
        mut child: Reaper,
        startup: Arc<StartupTiming>,
    ) -> Result<Spawned> {
        let group = match self.groups.attach(&child.child) {
            Ok(group) => group,
            Err(source) => return Err(InternalError::Platform { source }.into()),
        };
        let pid = child.child.id();
        let memory = Arc::from(self.memory.monitor(pid));
        let discover_memory = Arc::new(AtomicBool::new(false));
        let stdin = child
            .child
            .stdin
            .take()
            .expect("stdin is configured as a pipe");
        let stdout = child
            .child
            .stdout
            .take()
            .expect("stdout is configured as a pipe");
        let stderr = child
            .child
            .stderr
            .take()
            .expect("stderr is configured as a pipe");
        let (outgoing, outgoing_frames) = mpsc::sync_channel(2);
        let (incoming_frames, incoming) = mpsc::sync_channel(2);
        let (exited_tx, exited) = mpsc::sync_channel(1);
        let (drained, diagnostics_done) = mpsc::sync_channel(1);
        let control: Arc<dyn WorkerControl> = Arc::new(ProcessControl {
            memory: Arc::clone(&memory),
            discover_memory: Arc::clone(&discover_memory),
            group,
            outgoing: outgoing.clone(),
            exited: Mutex::new(exited),
            drained: Mutex::new(diagnostics_done),
            clock: Arc::clone(&self.clock),
            startup: Arc::downgrade(&startup),
        });
        child.attached(Arc::clone(&control));
        let diagnostics = Arc::clone(&self.diagnostics);
        let timings = self.timings;
        let phases = PhaseState::default();
        let diagnostic_phases = phases.clone();
        let tasks: Vec<Box<dyn FnOnce() + Send>> = vec![
            Box::new(move || write_frames(stdin, outgoing_frames)),
            Box::new(move || read_frames(stdout, incoming_frames)),
            Box::new(move || {
                read_diagnostics(stderr, diagnostics, timings, diagnostic_phases);
                let _ = drained.send(());
            }),
            Box::new(move || {
                child.started();
                complete(&mut ProcessCompletion { child }, exited_tx);
            }),
        ];
        for task in tasks {
            if let Err(source) = self.threads.spawn(task) {
                let span = startup.stop();
                let _scope = span.enter();
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
            Box::new(ForwardEvents {
                diagnostics: Arc::clone(&self.diagnostics),
                phases: phases.clone(),
            }),
            launch.version.clone(),
        )
        .with_timings(self.timings)
        .with_capture(
            launch
                .capture_durability
                .then(|| CaptureHint::from_volumes(self.volumes.local())),
        );
        startup.hand_off();
        Ok(Spawned {
            worker: Box::new(ProcessWorker {
                diagnostics: self.diagnostics.clone(),
                client: Box::new(client),
                clock: Arc::clone(&self.clock),
                memory,
                discover_memory,
                deadlines,
                phases,
            }),
            control,
        })
    }
}

impl WorkerFactory for NodeFactory {
    fn spawn(&self, launch: &Launch) -> std::result::Result<Spawned, SpawnFailure> {
        let command = match self.command(launch) {
            Ok(command) => command,
            Err(error) => return Err(SpawnFailure::NotStarted(error)),
        };
        let startup = Arc::new(StartupTiming::default());
        let child = match self.parent.spawn(command) {
            Ok(child) => Reaper::new(child, Arc::clone(&startup), Arc::clone(&self.groups)),
            Err(_) => {
                return Err(SpawnFailure::NotStarted(Error::Unavailable {
                    part: launch.node.display().to_string(),
                }));
            }
        };
        match self.spawn_owned(launch, child, startup) {
            Ok(spawned) => Ok(spawned),
            Err(error) => Err(SpawnFailure::Started(error)),
        }
    }
}
