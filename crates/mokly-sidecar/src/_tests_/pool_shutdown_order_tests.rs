//! Busy processes are killed together and reaped before lifecycle cancellation returns.

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::workers::{ClockMock, ControlMock, WorkerControl};

#[test]
fn busy_cancellation_kills_then_reaps_every_process() {
    let mock = Unimock::new((
        ClockMock::now_ms.each_call(matching!()).returns(100_u64),
        ControlMock::kill
            .next_call(matching!())
            .answers(&|_| Ok(()))
            .n_times(2),
        ControlMock::finish
            .next_call(matching!(2100))
            .answers(&|_, _| Ok(()))
            .n_times(2),
    ));
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(mock.clone()),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 2.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    {
        let mut state = pool.lock().unwrap();
        state.slots = vec![None, None];
        let control: Arc<dyn WorkerControl> = Arc::new(mock.clone());
        state.controls = BTreeMap::from([(0, control.clone()), (1, control)]);
    }
    pool.cancel_requests().unwrap();
    assert!(pool.lock().unwrap().controls.is_empty());
}
