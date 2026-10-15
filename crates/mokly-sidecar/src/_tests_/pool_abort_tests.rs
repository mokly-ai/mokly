//! Immediate abort kills owned processes without consulting a grace-period clock.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::workers::ControlMock;

#[test]
fn abort_kills_without_waiting_for_a_graceful_finish() {
    let control = Unimock::new(ControlMock::kill.next_call(matching!()).returns(Ok(())));
    let pool = Pool::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "npm-version".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    pool.state
        .lock()
        .unwrap()
        .controls
        .insert(0, Arc::new(control.clone()));
    let service: &dyn SidecarPool = &pool;
    service.abort().unwrap();
    assert!(pool.state.lock().unwrap().stopped);
}
