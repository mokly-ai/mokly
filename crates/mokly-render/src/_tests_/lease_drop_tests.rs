//! Final leases queue release while workers and the PostCSS cache remain busy.

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, mpsc};

use mokly_sidecar::methods::{Call, Generation};
use mokly_sidecar::pool::{PoolMock, SidecarPool};
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::postcss_cache::CssCache;

use super::{BundleLease, ContextLease};

#[test]
fn final_leases_return_while_a_pool_request_and_cache_lock_are_held() {
    let (entered, started) = mpsc::channel();
    let (finish, waiting) = mpsc::channel();
    let waiting = Mutex::new(waiting);
    let mock = Unimock::new((
        PoolMock::request
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                entered.send(()).unwrap();
                waiting.lock().unwrap().recv().unwrap();
                Ok(MethodResult::Empty)
            })),
        PoolMock::release_generation
            .next_call(matching!("old", 7))
            .returns(()),
        PoolMock::release_context
            .next_call(matching!("used"))
            .returns(()),
    ));
    let pool: Arc<dyn SidecarPool> = Arc::new(mock.clone());
    let cache = Mutex::new(CssCache::default());
    let releases = cache.lock().unwrap().releases.clone();
    let mut notices = Vec::new();
    std::thread::scope(|scope| {
        let active = pool.clone();
        let request = scope.spawn(move || {
            active.request(Call::Describe(Generation {
                generation: "busy".into(),
            }))
        });
        started.recv().unwrap();
        {
            let mut cache = cache.lock().unwrap();
            {
                let _lease = BundleLease {
                    id: "old".into(),
                    epoch: 7,
                    pool: pool.clone(),
                };
            }
            {
                let _lease = ContextLease {
                    id: "used".into(),
                    pool: pool.clone(),
                    used: AtomicBool::new(true),
                    released: releases.clone(),
                };
            }
            {
                let _lease = ContextLease {
                    id: "unused".into(),
                    pool: pool.clone(),
                    used: AtomicBool::new(false),
                    released: releases,
                };
            }
            notices.extend(cache.released.try_iter());
            cache.purge();
        }
        finish.send(()).unwrap();
        request.join().unwrap().unwrap();
    });
    assert_eq!(
        notices,
        ["used"],
        "unused contexts retain no release metadata"
    );
}
