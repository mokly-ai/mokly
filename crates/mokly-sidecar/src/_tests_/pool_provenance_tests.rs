//! Equal compiled code must retain each generation's dependency lookup provenance.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::compiled::CompiledGeneration;
use crate::methods::{Bundle, Call};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{FactoryMock, Spawned, WorkerMock};

#[test]
fn sharing_code_keeps_different_unmapped_directory_records() {
    let next = Mutex::new(0);
    let worker = Unimock::new((
        WorkerMock::handshake
            .next_call(matching!(_))
            .returns(Ok(())),
        WorkerMock::request
            .each_call(matching!((request, _) if matches!(request.call, Call::Bundle(_))))
            .answers_arc(Arc::new(move |_, _, _| {
                let id = {
                    let mut next = next.lock().unwrap();
                    *next += 1;
                    next.to_string()
                };
                Ok(MethodResult::Bundle(results::Bundle {
                    unmapped_dependency_directories: Some(vec![id.clone()]),
                    epoch: 0,
                    generation: id.clone(),
                    modules: vec![],
                    warnings: vec![],
                    compiled: Some(CompiledGeneration {
                        unmapped_dependency_directories: Some(vec![id]),
                        identity: "same".into(),
                        code: "code".into(),
                        runtime_key: "key".into(),
                        dependency_roots: vec![],
                        css_modules: vec![],
                        sources: Default::default(),
                        peers: Default::default(),
                        inputs: Default::default(),
                        metadata_inputs: Default::default(),
                        input_directories: Default::default(),
                        metadata_directories: Default::default(),
                    }),
                }))
            }))
            .n_times(2),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0))
            .n_times(2),
    ));
    let spawned_worker = worker.clone();
    let pool = Pool::new(
        Arc::new(Unimock::new(
            FactoryMock::spawn
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(Spawned {
                        worker: Box::new(spawned_worker.clone()),
                        control: Arc::new(spawned_worker.clone()),
                    })
                })),
        )),
        Arc::new(Unimock::new(())),
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
    for evaluation in ["first", "second"] {
        pool.request(Call::Bundle(Bundle {
            evaluation: Some(evaluation.into()),
            entry_files: vec![],
            renderer: None,
            stories_files: vec![],
            module_resolution: Default::default(),
            source_root: "/repo".into(),
            configuration_directory: ".".into(),
            repository_roots: vec![],
        }))
        .unwrap();
    }
    let state = pool.lock().unwrap();
    assert_eq!(
        state.compiled["1"].unmapped_dependency_directories,
        Some(vec!["1".into()])
    );
    assert_eq!(
        state.compiled["2"].unmapped_dependency_directories,
        Some(vec!["2".into()])
    );
}
