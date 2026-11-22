//! Worker identity makes the serial red path fail before any blocking gate.

use std::cell::RefCell;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::sync::{Arc, Barrier, Mutex};
use std::thread::{self, ThreadId};

use mokly_css::types::StylesheetRoot;

thread_local! {
    static EXIT: RefCell<Option<Exit>> = const { RefCell::new(None) };
}

struct Exit {
    gate: Arc<ReverseGate>,
    index: usize,
}

impl Drop for Exit {
    fn drop(&mut self) {
        self.gate.active.fetch_sub(1, Ordering::SeqCst);
        self.gate.exited.lock().unwrap().push(self.index);
        if !self.index.is_multiple_of(self.gate.width) {
            let _ = self.gate.senders[self.index - 1].send(());
        }
    }
}

pub(super) struct ReverseGate {
    caller: ThreadId,
    width: usize,
    barriers: Vec<Barrier>,
    senders: Vec<Sender<()>>,
    receivers: Vec<Mutex<Receiver<()>>>,
    pub(super) active: AtomicUsize,
    pub(super) peak: AtomicUsize,
    pub(super) started: Mutex<Vec<usize>>,
    pub(super) exited: Mutex<Vec<usize>>,
}

impl ReverseGate {
    pub(super) fn new(count: usize, width: usize) -> Arc<Self> {
        let (senders, receivers) = (0..count)
            .map(|_| {
                let (sender, receiver) = channel();
                (sender, Mutex::new(receiver))
            })
            .unzip();
        Arc::new(Self {
            caller: thread::current().id(),
            width,
            barriers: (0..count.div_ceil(width))
                .map(|index| Barrier::new(width.min(count - index * width)))
                .collect(),
            senders,
            receivers,
            active: AtomicUsize::new(0),
            peak: AtomicUsize::new(0),
            started: Mutex::default(),
            exited: Mutex::default(),
        })
    }

    pub(super) fn enter(self: &Arc<Self>, root: &StylesheetRoot) {
        assert_ne!(thread::current().id(), self.caller, "root ran serially");
        let index: usize = root.path[1..]
            .strip_suffix(".css")
            .unwrap()
            .parse()
            .unwrap();
        let active = self.active.fetch_add(1, Ordering::SeqCst) + 1;
        self.peak.fetch_max(active, Ordering::SeqCst);
        self.started.lock().unwrap().push(index);
        EXIT.with(|slot| {
            *slot.borrow_mut() = Some(Exit {
                gate: self.clone(),
                index,
            });
        });
        self.barriers[index / self.width].wait();
        let next = index + 1;
        if next < self.receivers.len() && !next.is_multiple_of(self.width) {
            self.receivers[index].lock().unwrap().recv().unwrap();
        }
    }
}
