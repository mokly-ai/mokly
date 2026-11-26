//! Actual document planning and Session construction with mocked source IO.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::delivery_inputs::DeliveryInputs;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::workers::RenderWorkersMock;
use crate::{planning, styles};

pub(super) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        modules: Default::default(),
        authored_inputs: vec![],
        roots: vec![],
    }
}

pub(super) fn session(
    config: ResolvedConfig,
    catalogue: PreparedCatalogue,
    source: &str,
) -> Session {
    let source = source.to_owned();
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(source.clone())))
            .at_least_times(0),
        RenderWorkersMock::cancelled
            .each_call(matching!())
            .returns(false)
            .at_least_times(0),
    )));
    let graph = Graph {
        inputs: DeliveryInputs::default(),
        tree: mock.clone(),
        composer: mock.clone(),
        stylesheets: mock.clone(),
        cache: mock.clone(),
        workers: mock.clone(),
        version: "test".into(),
    };
    let plans = planning::documents(
        &graph,
        &config,
        &catalogue,
        &NodeKey("config".into()),
        &BTreeMap::new(),
        &styles::Matchers::new(&config).unwrap(),
        "",
    )
    .unwrap();
    Session::new(
        &graph,
        SessionInput {
            stylesheet_imports: Default::default(),
            stylesheet_resolution_files: Default::default(),
            stylesheet_resolution_roots: Default::default(),
            matchers: Matchers::new(&config).unwrap(),
            config,
            catalogue,
            plans,
            resources: BTreeMap::new(),
            policy: mock,
            generation_key: "generation".into(),
            directories: vec![],
        },
    )
}
