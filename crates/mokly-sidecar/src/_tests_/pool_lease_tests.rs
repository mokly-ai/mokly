//! Late epoch releases cannot remove a replacement lifetime with the same id.

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Bundle, Call, CssModules};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{FactoryMock, Spawned, WorkerMock};

fn bundle() -> Call {
    Call::Bundle(Bundle {
        evaluation: None,
        entry_files: vec![],
        stories_files: vec![],
        renderer: None,
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    })
}

#[test]
fn a_late_old_epoch_release_preserves_the_same_ids_new_lifetime() {
    let worker = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(_))
            .returns(Ok(())),
        WorkerMock::request
            .next_call(matching!((request, _) if matches!(request.call, Call::Bundle(_))))
            .answers(&|_, _, _| {
                Ok(MethodResult::Bundle(results::Bundle {
                    unmapped_dependency_directories: None,
                    epoch: 0,
                    compiled: None,
                    generation: "g".into(),
                    modules: vec![],
                    warnings: vec![],
                }))
            })
            .n_times(2),
        WorkerMock::request
            .next_call(matching!((request, _) if matches!(request.call, Call::CssModules(_))))
            .returns(Ok(MethodResult::Empty)),
        WorkerMock::request
            .next_call(matching!((request, _) if matches!(request.call, Call::Dispose(_))))
            .returns(Ok(MethodResult::Empty)),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    ));
    let supplied = std::sync::Mutex::new(Some(Spawned {
        worker: Box::new(worker.clone()),
        control: Arc::new(worker.clone()),
    }));
    let factory = Unimock::new(
        FactoryMock::spawn
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(supplied.lock().unwrap().take().unwrap())
            })),
    );
    let pool = Pool::new(
        Arc::new(factory.clone()),
        Arc::new(Unimock::new(())),
        Launch {
            node: "node".into(),
            entry: "sidecar.js".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    let MethodResult::Bundle(old) = pool.request(bundle()).unwrap() else {
        panic!()
    };
    let MethodResult::Bundle(new) = pool.request(bundle()).unwrap() else {
        panic!()
    };
    assert_ne!(old.epoch, new.epoch);
    pool.release_generation("g", old.epoch);
    pool.synchronize_releases();
    assert!(pool.lock().unwrap().bundles.contains_key("g"));
    pool.request(Call::CssModules(CssModules {
        generation: "g".into(),
        class_maps: BTreeMap::new(),
    }))
    .unwrap();
    pool.release_generation("g", old.epoch);
    assert!(pool.lock().unwrap().maps.contains_key("g"));
    pool.release_generation("g", new.epoch);
    pool.synchronize_releases();
    assert!(pool.lock().unwrap().bundles.is_empty());
    assert!(
        pool.lock().unwrap().slots[0]
            .as_ref()
            .unwrap()
            .generations
            .is_empty()
    );
}
