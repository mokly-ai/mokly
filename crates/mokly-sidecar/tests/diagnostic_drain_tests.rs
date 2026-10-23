//! A real child delivers its partial stderr tail before completion reports drainage.

use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, SyncSender, TryRecvError};
use std::sync::{Arc, Mutex};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::error::Result;
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::process_clock::{SystemClock, Wait};
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::wire::Frame;
use mokly_sidecar::workers::{Clock, Diagnostics, WorkerFactory};

struct Reporter {
    pieces: Mutex<Vec<String>>,
    tail: SyncSender<()>,
    resume: Mutex<Receiver<()>>,
}

impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        if message == "é-tail" {
            self.tail.send(()).unwrap();
            self.resume.lock().unwrap().recv().unwrap();
        }
        self.pieces.lock().unwrap().push(message.to_owned());
    }
}

struct DrainClock {
    system: SystemClock,
    tail: Mutex<Receiver<()>>,
    resume: SyncSender<()>,
}

impl Clock for DrainClock {
    fn now_ms(&self) -> u64 {
        self.system.now_ms()
    }
}

impl Wait for DrainClock {
    fn frame(
        &self,
        receiver: &Receiver<Result<Frame>>,
        deadline: u64,
        timeout_ms: u64,
    ) -> Result<Frame> {
        self.system.frame(receiver, deadline, timeout_ms)
    }

    fn exited(&self, receiver: &Receiver<()>, _: u64) -> bool {
        receiver.recv().unwrap();
        true
    }

    fn drained(&self, receiver: &Receiver<()>, _: u64) -> bool {
        self.tail.lock().unwrap().recv().unwrap();
        let premature = receiver.try_recv();
        self.resume.send(()).unwrap();
        assert_eq!(premature, Err(TryRecvError::Empty));
        receiver.recv().unwrap();
        true
    }

    fn reaped(&self, receiver: &Receiver<()>) {
        receiver.recv().unwrap();
    }
}

#[test]
fn real_child_flushes_exact_stderr_pieces_before_signalling_drained() {
    let (tail, entered) = mpsc::sync_channel(1);
    let (resume, resumed) = mpsc::sync_channel(1);
    let reporter = Arc::new(Reporter {
        pieces: Mutex::new(Vec::new()),
        tail,
        resume: Mutex::new(resumed),
    });
    let clock = Arc::new(DrainClock {
        system: SystemClock::new(),
        tail: Mutex::new(entered),
        resume,
    });
    let factory = NodeFactory::new(
        Arc::new(SystemProcessGroups),
        clock,
        reporter.clone(),
        Arc::new(SystemMemory),
    );
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let mut process = factory
        .spawn(&Launch {
            node: "node".into(),
            entry: root.join("tests/fixtures/sidecar/shutdown-tail.mjs"),
            repository: root,
            version: "drain-fixture".into(),
        })
        .unwrap();
    process.worker.handshake(30_000).unwrap();
    assert!(reporter.pieces.lock().unwrap().is_empty());
    process.control.shutdown().unwrap();
    process.control.finish(0).unwrap();
    assert_eq!(
        *reporter.pieces.lock().unwrap(),
        [
            "after shutdown".to_owned(),
            "A".repeat(65_535),
            "é-tail".to_owned()
        ]
    );
}
