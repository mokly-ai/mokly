//! A live slot retains exponential memory back-off across replacement workers.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, ModuleResolution, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, FactoryMock, Spawned, WorkerMock};

#[test]
fn sixty_four_high_memory_requests_have_five_recycles_and_one_notice() {
    let counts = Arc::new(Mutex::new((0, 0, 0)));
    let spawned = counts.clone();
    let factory = Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let index = {
                    let mut counts = spawned.lock().unwrap();
                    let index = counts.0;
                    counts.0 += 1;
                    index
                };
                let stopped = spawned.clone();
                let warned = spawned.clone();
                let common = (
                    WorkerMock::handshake
                        .next_call(matching!(_))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(MethodResult::Empty))
                        .n_times([2, 4, 8, 16, 32, 2][index]),
                );
                let worker = if index == 5 {
                    Unimock::new(common)
                } else {
                    let pressure = (
                        WorkerMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(1_073_741_825))
                            .n_times(if index == 0 { 2 } else { 1 }),
                        ControlMock::shutdown
                            .next_call(matching!())
                            .answers_arc(Arc::new(move |_| {
                                stopped.lock().unwrap().1 += 1;
                                Ok(())
                            })),
                        ControlMock::finish.next_call(matching!(_)).returns(Ok(())),
                    );
                    if index == 1 {
                        Unimock::new((
                            common,
                            pressure,
                            WorkerMock::memory_pressure
                                .some_call(matching!())
                                .answers_arc(Arc::new(move |_| {
                                    warned.lock().unwrap().2 += 1;
                                })),
                        ))
                    } else {
                        Unimock::new((common, pressure))
                    }
                };
                Ok(Spawned {
                    worker: Box::new(worker.clone()),
                    control: Arc::new(worker),
                })
            })),
    );
    let pool: &dyn SidecarPool = &Pool::new(
        Arc::new(factory),
        Arc::new(Unimock::new(
            ClockMock::now_ms.each_call(matching!()).returns(0_u64),
        )),
        Launch {
            node: "node".into(),
            entry: "sidecar".into(),
            repository: "/repo".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    for _ in 0..64 {
        pool.request(Call::ProcessCss(ProcessCss {
            repository_roots: vec![],
            context: "css".into(),
            source_root: "/repo".into(),
            module_resolution: ModuleResolution::default(),
            postcss: "config".into(),
            source_path: "style".into(),
            text: String::new(),
        }))
        .unwrap();
    }
    assert_eq!(*counts.lock().unwrap(), (6, 5, 1));
}
