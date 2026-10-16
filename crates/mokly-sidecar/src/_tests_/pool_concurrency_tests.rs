//! FIFO lease order and process bounds are proved with explicit handshakes.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Call, ModuleResolution, ProcessCss};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::results::Css;
use crate::wire::MethodResult;
use crate::workers::{FactoryMock, Spawned, WorkerMock};

fn call(index: usize) -> Call {
    Call::ProcessCss(ProcessCss {
        repository_roots: Vec::new(),
        context: "css".into(),
        source_root: "/repo".into(),
        module_resolution: ModuleResolution::default(),
        postcss: "config".into(),
        source_path: "x.css".into(),
        text: index.to_string(),
    })
}

fn wait_queued(pool: &Pool, count: u64) {
    let mut state = pool.lock().unwrap();
    while state.ticket < count {
        state = pool.ready.wait(state).unwrap();
    }
}

#[test]
fn leases_are_fifo_and_concurrent_requests_never_exceed_the_size_bound() {
    for size in [1_usize, 2] {
        let (entered, events) = mpsc::channel();
        let mut releases = Vec::new();
        let mut receivers = Vec::new();
        for _ in 0..5 {
            let (send, receive) = mpsc::channel();
            releases.push(send);
            receivers.push(Mutex::new(receive));
        }
        let receivers = Arc::new(receivers);
        let workers = Mutex::new(
            (0..size)
                .map(|_| {
                    let entered = entered.clone();
                    let receivers = Arc::clone(&receivers);
                    let worker = Unimock::new((
                        WorkerMock::handshake
                            .next_call(matching!(_))
                            .returns(Ok(())),
                        WorkerMock::request
                            .each_call(matching!(_, _))
                            .answers_arc(Arc::new(move |_, request, _| {
                                let Call::ProcessCss(params) = &request.call else {
                                    panic!()
                                };
                                let index = params.text.parse::<usize>().unwrap();
                                entered.send(index).unwrap();
                                receivers[index].lock().unwrap().recv().unwrap();
                                Ok(MethodResult::Css(Css {
                                    unmapped_dependency_directories: None,
                                    text: params.text.clone(),
                                    dependencies: Vec::new(),
                                }))
                            })),
                        WorkerMock::resident_bytes
                            .each_call(matching!())
                            .answers(&|_| Ok(0)),
                    ));
                    Spawned {
                        worker: Box::new(worker.clone()),
                        control: Arc::new(worker),
                    }
                })
                .collect::<Vec<_>>(),
        );
        let factory = Unimock::new(
            FactoryMock::spawn
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(workers.lock().unwrap().pop().unwrap())
                }))
                .n_times(size),
        );
        let pool = Arc::new(Pool::new(
            Arc::new(factory),
            Arc::new(Unimock::new(())),
            Launch {
                node: "node".into(),
                entry: "sidecar.js".into(),
                repository: "/repo".into(),
                version: "test".into(),
            },
            PoolOptions {
                size: size.try_into().unwrap(),
                timeout_ms: None,
            },
        ));
        let mut threads = Vec::new();
        for index in 0..5 {
            let caller = Arc::clone(&pool);
            threads.push(thread::spawn(move || caller.request(call(index)).unwrap()));
            wait_queued(&pool, index as u64 + 1);
            if index < size {
                assert_eq!(events.recv().unwrap(), index);
            }
        }
        assert_eq!(pool.lock().unwrap().slots.len(), size);
        assert_eq!(pool.lock().unwrap().serving, size as u64);
        assert!(matches!(events.try_recv(), Err(mpsc::TryRecvError::Empty)));
        for (index, release) in releases.iter().enumerate() {
            release.send(()).unwrap();
            if index + size < 5 {
                assert_eq!(events.recv().unwrap(), index + size);
            }
        }
        for thread in threads {
            assert!(matches!(thread.join().unwrap(), MethodResult::Css(_)));
        }
        assert_eq!(pool.lock().unwrap().slots.len(), size);
    }
}
