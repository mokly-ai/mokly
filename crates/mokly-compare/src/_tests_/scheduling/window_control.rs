//! Record all admitted indices, including deferred and failed preparation slots.

use std::sync::atomic::Ordering;
use std::sync::{Mutex, mpsc};
use std::thread::{self, ThreadId};

use mokly_graph::comparison_stream::ComparisonConsumer;
use mokly_graph::workers::{ComparisonTask, RenderWorkers, ThreadWorkers};

use super::control::Control;

impl Control {
    pub(super) fn stream(&self, task: &dyn ComparisonTask, consumer: &mut dyn ComparisonConsumer) {
        self.stream_calls.fetch_add(1, Ordering::SeqCst);
        if self.rolling {
            let (send, receive) = mpsc::channel();
            let work = Work {
                control: self,
                inner: task,
                send: &send,
                receive: Mutex::new(receive),
                caller: thread::current().id(),
            };
            ThreadWorkers::new(self.capacity.unwrap_or(2))
                .unwrap()
                .comparison_stream(
                    &work,
                    &mut Recording {
                        control: self,
                        inner: consumer,
                        release: &send,
                    },
                );
            return;
        }
        let mut next = 0;
        loop {
            let start = next;
            for _ in 0..self.capacity.unwrap_or(2).max(1) {
                if !consumer.admit(next) {
                    break;
                }
                next += 1;
            }
            if start == next {
                break;
            }
            self.schedule(next - start, &Offset { task, start });
            for index in start..next {
                if !consumer.consume(index) {
                    return;
                }
            }
        }
    }
}

struct Recording<'a> {
    control: &'a Control,
    inner: &'a mut dyn ComparisonConsumer,
    release: &'a mpsc::Sender<()>,
}

impl ComparisonConsumer for Recording<'_> {
    fn admit(&mut self, index: usize) -> bool {
        if !self.inner.admit(index) {
            let _ = self.release.send(());
            return false;
        }
        self.control.admitted.lock().unwrap().push(index);
        true
    }
    fn consume(&mut self, index: usize) -> bool {
        self.control.window.lock().unwrap().push(
            self.control.admitted.lock().unwrap().len()
                - self.control.consumed.lock().unwrap().len(),
        );
        if self.control.cancel_after_batch != 0 {
            self.control
                .cancellation
                .store(self.control.cancel_after_batch, Ordering::SeqCst);
        }
        let result = self.inner.consume(index);
        self.control.consumed.lock().unwrap().push(index);
        result
    }
}

struct Offset<'a> {
    task: &'a dyn ComparisonTask,
    start: usize,
}
impl ComparisonTask for Offset<'_> {
    fn run(&self, index: usize) {
        self.task.run(self.start + index);
    }
}

struct Work<'a> {
    control: &'a Control,
    inner: &'a dyn ComparisonTask,
    send: &'a mpsc::Sender<()>,
    receive: Mutex<mpsc::Receiver<()>>,
    caller: ThreadId,
}

impl ComparisonTask for Work<'_> {
    fn run(&self, index: usize) {
        self.control.started.lock().unwrap().push(index);
        let controlled = self.control.later_first && thread::current().id() != self.caller;
        if controlled && index == 0 {
            let _ = self.receive.lock().unwrap().recv();
        }
        let _release = (controlled && index == 1).then(|| Release(self.send));
        self.inner.run(index);
        self.control.event(format!("complete:{index}"));
    }
}

struct Release<'a>(&'a mpsc::Sender<()>);
impl Drop for Release<'_> {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}
