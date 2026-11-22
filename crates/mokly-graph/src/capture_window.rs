//! Completion-driven capture slots with a caller-owned encoded byte budget.

use std::collections::BTreeSet;
use std::fmt;
use std::sync::mpsc::{self, Sender};

use crate::worker_context::WorkerContext;
use crate::workers::ComparisonTask;

/// Ordered capture controls admission and charges completed encoded results.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CaptureConsumerMock))]
pub trait CaptureConsumer {
    /// Admit the next route index, or return false at the end of the side.
    fn admit(&mut self, index: usize) -> bool;
    /// Record completion and release its slot only when queued bytes fit.
    /// False keeps the slot and permits another call after a later completion.
    fn complete(&mut self, index: usize) -> bool;
}

pub(crate) struct All {
    pub(crate) count: usize,
}

impl CaptureConsumer for All {
    fn admit(&mut self, index: usize) -> bool {
        index < self.count
    }
    fn complete(&mut self, _index: usize) -> bool {
        true
    }
}

impl fmt::Debug for dyn CaptureConsumer + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("CaptureConsumer")
    }
}

pub(crate) fn sequential(task: &dyn ComparisonTask, consumer: &mut dyn CaptureConsumer) {
    let mut index = 0;
    while consumer.admit(index) {
        task.run(index);
        consumer.complete(index);
        index += 1;
    }
}

pub(crate) fn parallel(
    pool: &rayon::ThreadPool,
    limit: usize,
    task: &dyn ComparisonTask,
    consumer: &mut dyn CaptureConsumer,
) {
    if pool.current_thread_index().is_some() {
        sequential(task, consumer);
        return;
    }
    let context = WorkerContext::current();
    let limit = limit.max(1).min(pool.current_num_threads());
    pool.in_place_scope(|scope| {
        let (send, receive) = mpsc::channel();
        let mut active = 0;
        let mut next = 0;
        let mut ended = false;
        let mut completed = BTreeSet::new();
        loop {
            while !ended && active < limit {
                if !consumer.admit(next) {
                    ended = true;
                    break;
                }
                let send = send.clone();
                let context = &context;
                let index = next;
                scope.spawn(move |_| {
                    let mut completion = Completion {
                        index,
                        send,
                        finished: false,
                    };
                    context.in_scope(|| task.run(index));
                    completion.finished = true;
                });
                active += 1;
                next += 1;
            }
            if active == 0 {
                break;
            }
            let Ok((index, true)) = receive.recv() else {
                break;
            };
            completed.insert(index);
            let released: Vec<_> = completed
                .iter()
                .copied()
                .filter(|index| consumer.complete(*index))
                .collect();
            for index in released {
                completed.remove(&index);
                active -= 1;
            }
        }
    });
}

/// Even a panicked task releases its caller before the scope joins the panic.
struct Completion {
    index: usize,
    send: Sender<(usize, bool)>,
    finished: bool,
}

impl Drop for Completion {
    fn drop(&mut self) {
        let _ = self.send.send((self.index, self.finished));
    }
}

#[cfg(test)]
#[path = "_tests_/capture_window_tests.rs"]
mod capture_window_tests;
