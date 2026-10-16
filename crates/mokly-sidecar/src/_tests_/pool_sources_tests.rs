//! Launch directories stay fixed across head/base work and generation restoration.

use std::path::Path;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::methods::{Bundle, Call, Generation, ProcessCss, RenderPage};
use crate::pool::{Pool, SidecarPool};
use crate::pool_options::{Launch, PoolOptions};
use crate::wire::MethodResult;
use crate::workers::{ControlMock, FactoryMock, Spawned, WorkerMock};

fn pool(factory: Unimock) -> Pool {
    Pool::new(
        Arc::new(factory),
        Arc::new(Unimock::new(())),
        Launch {
            repository: "/head".into(),
            node: "node".into(),
            entry: "/package/sidecar.js".into(),
            version: "test".into(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

#[test]
fn changing_source_roots_kills_the_old_process_before_spawning_in_the_new_root() {
    let launches = Arc::new(Mutex::new(Vec::new()));
    let observed = launches.clone();
    let factory = Unimock::new(
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, launch| {
                observed.lock().unwrap().push(launch.repository.clone());
                let process = Unimock::new((
                    WorkerMock::handshake
                        .next_call(matching!(30_000))
                        .returns(Ok(())),
                    WorkerMock::request
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(MethodResult::Empty)),
                    WorkerMock::resident_bytes
                        .each_call(matching!())
                        .answers(&|_| Ok(0)),
                    ControlMock::kill.next_call(matching!()).returns(Ok(())),
                ));
                Ok(Spawned {
                    worker: Box::new(process.clone()),
                    control: Arc::new(process),
                })
            }))
            .n_times(3),
    );
    let pool = pool(factory);
    for root in ["/head", "/head", "/base", "/base", "/head"] {
        pool.request(Call::ProcessCss(ProcessCss {
            source_root: root.into(),
            context: root.into(),
            repository_roots: vec![],
            module_resolution: Default::default(),
            postcss: "postcss.mjs".into(),
            source_path: "style.css".into(),
            text: String::new(),
        }))
        .unwrap();
    }
    pool.abort().unwrap();
    assert_eq!(
        *launches.lock().unwrap(),
        [Path::new("/head"), Path::new("/base"), Path::new("/head")]
    );
}

#[test]
fn reloaded_generations_select_the_original_base_root() {
    let pool = pool(Unimock::new(()));
    pool.lock().unwrap().bundles.insert(
        "base".into(),
        Bundle {
            source_root: "/base".into(),
            configuration_directory: String::new(),
            entry_files: vec![],
            renderer: None,
            stories_files: vec![],
            module_resolution: Default::default(),
            repository_roots: vec![],
            evaluation: None,
        },
    );
    for call in [
        Call::Describe(Generation {
            generation: "base".into(),
        }),
        Call::RenderPage(RenderPage {
            generation: "base".into(),
            handle: "page".into(),
        }),
    ] {
        assert_eq!(
            pool.source_root(&call).unwrap().as_deref(),
            Some(Path::new("/base"))
        );
    }
}
