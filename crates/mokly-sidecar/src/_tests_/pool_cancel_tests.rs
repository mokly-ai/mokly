//! Cancellation wakes queued callers while an in-flight worker is drained.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::methods::{Call, ModuleResolution, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, FactoryMock, Spawned, WorkerMock};

#[test]
fn shutdown_cancels_queued_and_inflight_work_with_one_shared_deadline() {
    for crashed in [false, true] {
        let (started_tx, started_rx) = mpsc::sync_channel(1);
        let (release_tx, release_rx) = mpsc::sync_channel(1);
        let release_rx = Mutex::new(release_rx);
        let worker = Unimock::new((
            WorkerMock::handshake
                .next_call(matching!(30_000))
                .returns(Ok(())),
            WorkerMock::request
                .next_call(matching!(_, 60_000))
                .answers_arc(Arc::new(move |_, _, _| {
                    started_tx.send(()).unwrap();
                    release_rx.lock().unwrap().recv().unwrap();
                    if crashed {
                        Err(Error::Crashed)
                    } else {
                        Ok(MethodResult::Empty)
                    }
                })),
            ControlMock::shutdown.next_call(matching!()).returns(Ok(())),
            ControlMock::finish
                .next_call(matching!(2_100))
                .answers_arc(Arc::new(move |_, _| {
                    release_tx.send(()).unwrap();
                    Ok(())
                })),
            ControlMock::kill.next_call(matching!()).returns(Ok(())),
        ));
        let spawned = Mutex::new(Some(Spawned {
            worker: Box::new(worker.clone()),
            control: Arc::new(worker.clone()),
        }));
        let factory = Unimock::new((
            FactoryMock::spawn
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(spawned.lock().unwrap().take().unwrap())
                })),
            ClockMock::now_ms.next_call(matching!()).returns(100_u64),
        ));
        let pool = Pool::new(
            Arc::new(factory.clone()),
            Arc::new(factory),
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
        let call = || {
            Call::ProcessCss(ProcessCss {
                repository_roots: Vec::new(),
                context: "css".into(),
                source_root: "/repo".into(),
                module_resolution: ModuleResolution::default(),
                postcss: "config".into(),
                source_path: "source".into(),
                text: String::new(),
            })
        };
        thread::scope(|scope| {
            let active = scope.spawn(|| pool.request(call()));
            started_rx.recv().unwrap();
            let queued = scope.spawn(|| pool.request(call()));
            while pool.lock().unwrap().ticket < 2 {
                thread::yield_now();
            }
            pool.shutdown().unwrap();
            assert!(matches!(active.join().unwrap(), Err(Error::Cancelled)));
            assert!(matches!(queued.join().unwrap(), Err(Error::Cancelled)));
        });
    }
}
