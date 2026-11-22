//! Classification cancellation reaches an unfinished source without releasing its phase.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_server::changes::{ChangeCancellation, ChangeCancellationMock, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::{EagerAdmission, PreparationAdmission};
use crate::serve_eager_cancel::{OriginCancellation, OriginScope};
use crate::serve_eager_task::{
    NativeTasks, PreparationTasks, PreparationWorkMock, SourceCompletion,
};

#[test]
fn eager_source_wait_observes_classification_cancellation_and_joins_the_pending_source() {
    let origin = Arc::new(OriginCancellation::default());
    let (entered, entering) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let (source_saw, source_seen) = mpsc::channel();
    let (waiting, waited) = mpsc::channel();
    let waiting = Mutex::new(Some(waiting));
    let checked = origin.clone();
    let observed = origin.clone();
    let stopped = origin.clone();
    let cancellation = Arc::new(Unimock::new((
        ChangeCancellationMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if let Some(waiting) = waiting.lock().unwrap().take() {
                    waiting.send(()).unwrap();
                }
                checked.cancelled()
            })),
        ChangeCancellationMock::observe
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, signal| observed.observe(signal))),
        ChangeCancellationMock::cancel
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| stopped.cancel())),
    )));
    let source_origin = origin.clone();
    let reader_origin = origin.clone();
    let work = Arc::new(
        Unimock::new((
            PreparationWorkMock::sources
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    entered.send(()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                    source_saw.send(source_origin.cancelled()).unwrap();
                    SourceCompletion::Finished
                })),
            PreparationWorkMock::reader
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, cancel| reader_origin.reader(cancel))),
            PreparationWorkMock::discard
                .some_call(matching!())
                .returns(()),
        ))
        .no_verify_in_drop(),
    );
    let phase = Arc::new(PreparationAdmission::default());
    let tasks: &dyn PreparationTasks = &NativeTasks;
    let task = tasks.start(work, cancellation, phase.clone());
    entering.recv().unwrap();
    let classification = Arc::new(ChangeToken::default());
    let reader = classification.clone();
    let pending = task.clone();
    let wait = thread::spawn(move || pending.sources_ready(reader));
    waited.recv().unwrap();
    classification.cancel();
    let cancelled = origin.cancelled();
    if !cancelled {
        release.send(()).unwrap();
    }
    wait.join().unwrap();
    if cancelled {
        release.send(()).unwrap();
    }
    let source_cancelled = source_seen.recv().unwrap();
    task.cancel_and_join();
    assert_eq!(
        (cancelled, source_cancelled, phase.adopted()),
        (true, true, false)
    );
}
