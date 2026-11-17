//! Ordered caller consumption of indexed work with graph-owned admission.

use std::collections::VecDeque;
use std::fmt;
use std::sync::mpsc::{self, Receiver, Sender};

use crate::worker_context::WorkerContext;
use crate::workers::ComparisonTask;

/// Caller-owned route admission and ordered results, without comparison policy.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonConsumerMock))]
pub trait ComparisonConsumer {
    /// Install one index's metadata. False marks the end of the stream.
    fn admit(&mut self, index: usize) -> bool;
    /// Consume and release one index. False stops new admission and consumption.
    fn consume(&mut self, index: usize) -> bool;
}

impl fmt::Debug for dyn ComparisonConsumer + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ComparisonConsumer")
    }
}

/// Defaults retain only one view and finish preparation before its consumption.
pub(crate) fn sequential(task: &dyn ComparisonTask, consumer: &mut dyn ComparisonConsumer) {
    let mut index = 0;
    while consumer.admit(index) {
        task.run(index);
        if !consumer.consume(index) {
            break;
        }
        index += 1;
    }
}

/// Only the calling thread waits; admitted jobs never wait for consumption.
pub(crate) fn parallel(
    pool: &rayon::ThreadPool,
    task: &dyn ComparisonTask,
    consumer: &mut dyn ComparisonConsumer,
) {
    if pool.current_thread_index().is_some() {
        sequential(task, consumer);
        return;
    }
    let context = WorkerContext::current();
    let limit = pool.current_num_threads().max(1).saturating_mul(2);
    pool.in_place_scope(|scope| {
        let mut pending = VecDeque::new();
        let mut next = 0;
        let mut ended = false;
        loop {
            while !ended && pending.len() < limit {
                if consumer.admit(next) {
                    pending.push_back((next, spawn(scope, next, task, &context)));
                    next += 1;
                } else {
                    ended = true;
                }
            }
            let Some((index, completion)) = pending.pop_front() else {
                break;
            };
            if !matches!(completion.recv(), Ok(true)) || !consumer.consume(index) {
                break;
            }
        }
    });
}

fn spawn<'scope>(
    scope: &rayon::Scope<'scope>,
    index: usize,
    task: &'scope dyn ComparisonTask,
    context: &'scope WorkerContext,
) -> Receiver<bool> {
    let (send, receive) = mpsc::channel();
    scope.spawn(move |_| {
        let mut completion = Completion {
            send,
            finished: false,
        };
        context.in_scope(|| task.run(index));
        completion.finished = true;
    });
    receive
}

/// A panicked job releases its ordered wait before Rayon propagates the panic.
struct Completion {
    send: Sender<bool>,
    finished: bool,
}

impl Drop for Completion {
    fn drop(&mut self) {
        let _ = self.send.send(self.finished);
    }
}

#[cfg(test)]
#[path = "_tests_/stream_workers_tests.rs"]
mod stream_workers_tests;

#[cfg(test)]
#[path = "_tests_/stream_lifecycle_tests.rs"]
mod stream_lifecycle_tests;
