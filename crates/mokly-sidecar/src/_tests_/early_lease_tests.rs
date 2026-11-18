//! Early preparation takes bounded capacity without a process or FIFO waiter.

use std::sync::Arc;

use unimock::Unimock;

use crate::methods::{Call, Empty};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};

#[test]
fn an_empty_slot_can_be_claimed_by_only_one_early_lease() {
    for (size, expected) in [(1, (false, true, false)), (2, (true, true, true))] {
        let pool = Pool::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Launch {
                capture_durability: false,
                node: "node".into(),
                entry: "sidecar.js".into(),
                repository: "/head".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: size.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        let call = Call::Shutdown(Empty {});
        let first = pool.try_early(&call).unwrap();
        let second = pool.try_early(&call).unwrap();
        let acquired = first.is_some();
        let excluded = second.is_none();
        if let Some(first) = first {
            first.finish().unwrap();
        }
        if let Some(second) = second {
            second.finish().unwrap();
        }
        let reusable = pool.try_early(&call).unwrap();
        let returned = reusable.is_some();
        if let Some(reusable) = reusable {
            reusable.finish().unwrap();
        }
        pool.abort().unwrap();
        assert_eq!((acquired, excluded, returned), expected);
    }
}
