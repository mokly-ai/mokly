//! Description holds one runtime-wide lock through side effects on attempt snapshots.

use std::sync::{Arc, Mutex, OnceLock};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_sidecar::error::{Error, ProtocolError};
use mokly_sidecar::pool::PoolMock;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;

#[test]
fn description_and_runtime_clones_hold_the_same_lock_at_the_io_boundary() {
    let gate: Arc<OnceLock<Arc<Mutex<()>>>> = Arc::new(OnceLock::new());
    let observed = gate.clone();
    let runtime = Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    assert!(observed.get().unwrap().try_lock().is_err());
                    Ok(None)
                }))
                .n_times(2),
        )),
        Arc::new(Unimock::new(
            PoolMock::request
                .each_call(matching!(_))
                .answers(&|_, _| Err(Error::Protocol(ProtocolError::Handshake)))
                .n_times(2),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    );
    gate.set(runtime.describing.clone()).unwrap();
    let config = ResolvedConfig {
        input: Config {
            renderer: Some("renderer.ts".into()),
            ..Default::default()
        },
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: vec![],
        authored_inputs: vec![],
    };
    let cloned = runtime.with_tree(Arc::new(Unimock::new(())));
    assert!(Arc::ptr_eq(&runtime.describing, &cloned.describing));
    for value in [&runtime, &cloned] {
        let provider: &dyn DefinitionProvider = value;
        assert!(provider.describe(&config, &[]).is_err());
    }
}
