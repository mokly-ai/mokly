//! Ordinary Serve handles leave admission observation to an actual eager pool.

use std::sync::{Arc, Mutex};

use mokly_server::changes::ChangeToken;
use mokly_sidecar::pool_admission::CapacityMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::PreparationAdmission;

use super::{PoolScheduling, ServePool};

#[test]
fn admission_observation_starts_with_the_first_eager_pool() {
    let observers = Arc::new(Mutex::new(Vec::new()));
    let observed = observers.clone();
    let capacity = Arc::new(Unimock::new(
        CapacityMock::observe_admission
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, observer| {
                observed.lock().unwrap().push(observer);
            })),
    ));
    let scheduler = ServePool::new(Arc::new(Unimock::new(())), capacity);
    let _head = scheduler.pool(None);
    let _serial = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    assert_eq!(observers.lock().unwrap().len(), 0);
    let _eager = scheduler.eager_pool(
        Arc::new(ChangeToken::default()),
        Arc::new(PreparationAdmission::default()),
    );
    let observers = observers.lock().unwrap();
    assert_eq!(observers.len(), 1);
    assert!(observers[0].strong_count() > 0);
}
