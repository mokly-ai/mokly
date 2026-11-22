//! Hold the encoder at one call, so the test can see where the step goes next.

use std::future::{Future, poll_fn};
use std::pin::{Pin, pin};
use std::sync::{Mutex, mpsc};
use std::task::Poll;

use tokio::sync::OwnedSemaphorePermit;
use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};

use crate::work::Workers;

/// The test side of an encoder hold.
pub(super) struct Hold {
    entered: UnboundedReceiver<()>,
    resume: mpsc::Sender<()>,
}

/// A hook that runs `action` at encode number `at`, then waits until the test releases it.
pub(super) fn hold(
    at: usize,
    action: impl Fn() + Send + Sync + 'static,
) -> (Hold, impl Fn(usize) + Send + Sync + 'static) {
    let (entered, held) = unbounded_channel();
    let (resume, resumed) = mpsc::channel();
    let resumed = Mutex::new(resumed);
    let hook = move |number| {
        if number == at {
            action();
            entered.send(()).unwrap();
            resumed.lock().unwrap().recv().unwrap();
        }
    };
    (
        Hold {
            entered: held,
            resume,
        },
        hook,
    )
}

impl Hold {
    /// Wait for the held encode, queue for the only worker of `work`, and release the encoder.
    /// Return the worker when the step releases it without ending, or `None` when it ends first.
    pub(super) async fn release(
        mut self,
        work: &Workers,
        run: &mut Pin<Box<dyn Future<Output = ()> + Send + '_>>,
    ) -> Option<OwnedSemaphorePermit> {
        let reached = tokio::select! {
            () = &mut *run => false,
            Some(()) = self.entered.recv() => true,
        };
        assert!(reached, "the step reaches the held encode");
        let mut worker = pin!(work.workers.clone().acquire_owned());
        let queued = poll_fn(|context| Poll::Ready(worker.as_mut().poll(context))).await;
        assert!(queued.is_pending(), "the held job keeps the only worker");
        self.resume.send(()).unwrap();
        tokio::select! {
            biased;
            () = &mut *run => None,
            worker = &mut worker => Some(worker.unwrap()),
        }
    }
}
