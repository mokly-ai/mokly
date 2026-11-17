//! Deterministic worker control records batches and decoded-result lifetimes.

use std::collections::BTreeSet;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex, Weak, mpsc};

use mokly_graph::cache::Artifact;
use mokly_graph::workers::ComparisonTask;

#[derive(Default)]
pub(super) struct Control {
    pub(super) entry_counts: Option<Vec<usize>>,
    pub(super) rolling: bool,
    pub(super) stream_calls: AtomicUsize,
    pub(super) started: Mutex<Vec<usize>>,
    pub(super) admitted: Mutex<Vec<usize>>,
    pub(super) consumed: Mutex<Vec<usize>>,
    pub(super) window: Mutex<Vec<usize>>,
    pub(super) batches: Mutex<Vec<usize>>,
    pub(super) events: Mutex<Vec<String>>,
    pub(super) artifacts: Mutex<Vec<Weak<Artifact>>>,
    pub(super) live: Mutex<Vec<usize>>,
    pub(super) errors: BTreeSet<usize>,
    pub(super) fail_from: Option<usize>,
    pub(super) resource_error: Option<usize>,
    pub(super) later_first: bool,
    pub(super) cancellation: AtomicUsize,
    pub(super) cancel_after_batch: usize,
    pub(super) cancel_in_view: usize,
    pub(super) capacity: Option<usize>,
    pub(super) overlap: bool,
    pub(super) has_deferred: bool,
    pub(super) restore_source: bool,
    pub(super) gate: Mutex<Option<Arc<Barrier>>>,
}

impl Control {
    pub(super) fn event(&self, event: String) {
        self.events.lock().unwrap().push(event);
    }

    pub(super) fn live(&self) -> usize {
        self.artifacts
            .lock()
            .unwrap()
            .iter()
            .filter(|artifact| artifact.strong_count() > 0)
            .count()
    }

    pub(super) fn schedule(&self, count: usize, task: &dyn ComparisonTask) {
        assert_eq!(
            self.live(),
            0,
            "a batch must release all decoded inputs before the next batch"
        );
        self.batches.lock().unwrap().push(count);
        let barrier = Barrier::new(count);
        let (send, receive) = mpsc::channel();
        if self.overlap {
            *self.gate.lock().unwrap() = Some(Arc::new(Barrier::new(count)));
        }
        let receive = Mutex::new(receive);
        let dispatch = tracing::dispatcher::get_default(Clone::clone);
        std::thread::scope(|scope| {
            for index in 0..count {
                let barrier = &barrier;
                let send = &send;
                let receive = &receive;
                let dispatch = &dispatch;
                scope.spawn(move || {
                    tracing::dispatcher::with_default(dispatch, || {
                        barrier.wait();
                        if self.later_first && index == 0 && count > 1 {
                            receive.lock().unwrap().recv().unwrap();
                        }
                        let _release = (self.later_first && index == 1).then_some(Release(send));
                        task.run(index);
                        self.event(format!("complete:{index}"));
                    })
                });
            }
        });
        if self.cancel_after_batch != 0 {
            self.cancellation
                .store(self.cancel_after_batch, Ordering::SeqCst);
        }
    }
}

struct Release<'a>(&'a mpsc::Sender<()>);

impl Drop for Release<'_> {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}
