//! A capacity-one owner must change its call role before joining pending validation.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::pool_admission::CapacityMock;
use mokly_sidecar::pool_claim::CallClaim;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::{EagerAdmission, PreparationAdmission};
use crate::serve_eager_task::{
    NativeTasks, PreparationTasks, PreparationWorkMock, SourceCompletion,
};
use crate::serve_pool::serve_pool_support::css;
use crate::serve_pool::{PoolScheduling, ServePool};

#[test]
fn eager_capacity_one_adoption_switches_the_real_owner_before_join() {
    let (entered, entering) = mpsc::channel();
    let entered = Mutex::new(Some(entered));
    let capacity = Unimock::new((
        CapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if let Some(entered) = entered.lock().unwrap().take() {
                    entered.send(()).unwrap();
                }
                1
            })),
        CapacityMock::try_claim
            .each_call(matching!())
            .answers(&|_| Ok(Some(CallClaim::fixed()))),
    ))
    .no_verify_in_drop();
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    let pool = Arc::new(
        Unimock::new(
            PoolMock::request
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    counted.fetch_add(1, Ordering::SeqCst);
                    Ok(MethodResult::Empty)
                })),
        )
        .no_verify_in_drop(),
    );
    let scheduler = ServePool::new(pool, Arc::new(capacity));
    let phase = Arc::new(PreparationAdmission::default());
    let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let pool = scheduler.eager_pool(cancel.clone(), phase.clone());
    let work = Arc::new(Unimock::new((
        PreparationWorkMock::sources
            .some_call(matching!())
            .returns(SourceCompletion::Head {
                classification: false,
            }),
        PreparationWorkMock::validate
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let _ = pool.request(css("/base", 0));
            })),
        PreparationWorkMock::reader
            .some_call(matching!(_))
            .returns(()),
        PreparationWorkMock::discard
            .some_call(matching!())
            .returns(()),
    )));
    let tasks: &dyn PreparationTasks = &NativeTasks;
    let task = tasks.start(work, cancel, phase.clone());
    task.head(Arc::new(Unimock::new(())));
    entering.recv().unwrap();
    task.continue_for_classification(Arc::new(ChangeToken::default()));
    let adopted = phase.adopted();
    if adopted {
        task.join().unwrap();
    }
    task.cancel_and_join();
    assert!(
        adopted,
        "the owner must switch admission before waiting for validation"
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
