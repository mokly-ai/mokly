//! A replacement worker cannot report reuse of a seed lost with the old process.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::error::Error;
use crate::methods::Call;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

use super::{answer, bundle, pool, unchanged_hit};

#[test]
fn a_product_exchange_crash_forgets_disk_reuse_on_the_replacement_worker() {
    let calls = Arc::new(Mutex::new(vec![]));
    let first = calls.clone();
    let worker = Unimock::new((
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| match request.call {
                Call::RestoreGeneration(_) => {
                    first.lock().unwrap().push("restore");
                    Ok(MethodResult::Empty)
                }
                Call::Bundle(_) => {
                    first.lock().unwrap().push("failed-bundle");
                    Err(Error::Crashed)
                }
                _ => panic!("unexpected request"),
            })),
        ControlMock::kill.some_call(matching!()).returns(Ok(())),
    ));
    let mut pool = pool(unchanged_hit(), worker);
    let replacement_calls = calls.clone();
    Arc::get_mut(&mut pool).unwrap().factory = Arc::new(Unimock::new(
        FactoryMock::spawn
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let captured = replacement_calls.clone();
                let replacement = Unimock::new((
                    WorkerMock::handshake
                        .some_call(matching!(_))
                        .returns(Ok(())),
                    WorkerMock::request
                        .some_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, request, _| {
                            assert!(matches!(request.call, Call::Bundle(_)));
                            captured.lock().unwrap().push("replacement-bundle");
                            Ok(answer("seed", 1))
                        })),
                    WorkerMock::resident_bytes
                        .some_call(matching!())
                        .returns(Ok(0)),
                ));
                Ok(Spawned {
                    worker: Box::new(replacement.clone()),
                    control: Arc::new(replacement),
                })
            })),
    ));
    let result = bundle(&pool);
    assert_eq!(result.cache, Some(CacheOutcome::StampMismatch));
    assert_eq!(
        *calls.lock().unwrap(),
        ["restore", "failed-bundle", "replacement-bundle"]
    );
}
