//! Injected services for real runtime and graph preparation without a side process.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{
    GenerationLease, JavaScriptCatalogue, JavaScriptGeneration, ResolvedDefinition,
};
use mokly_graph::cache::MemoryCache;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_graph::workers::RenderWorkersMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::Runtime;

#[derive(Debug)]
pub(super) struct Lease;

impl GenerationLease for Lease {}

pub(super) fn runtime() -> (Runtime, Arc<AtomicUsize>) {
    let jobs = Arc::new(AtomicUsize::new(0));
    let counted = jobs.clone();
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .some_call(matching!(_))
            .answers(&|_, _| Ok(None))
            .at_least_times(0),
    ));
    let workers = Unimock::new((
        RenderWorkersMock::comparison_tasks
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, count, task| {
                counted.fetch_add(count, Ordering::Relaxed);
                for index in 0..count {
                    task.run(index);
                }
            }))
            .at_least_times(0),
        RenderWorkersMock::stylesheets
            .some_call(matching!(_, _))
            .answers(&|_, _, _| Ok(vec![])),
    ));
    (
        Runtime::new(
            tree.clone(),
            tree,
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                PoolMock::request
                    .some_call(matching!(Call::Bindings(_)))
                    .answers(&|_, _| Ok(MethodResult::Empty)),
            )),
            Arc::new(MemoryCache::new(1024, 0)),
            Arc::new(workers),
            "test".into(),
            None,
        ),
        jobs,
    )
}

pub(super) fn prepare(
    runtime: &Runtime,
    value: &str,
    lease: Option<Arc<Lease>>,
) -> Arc<dyn RenderGeneration> {
    let config = ResolvedConfig {
        input: Default::default(),
        modules: Default::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![],
    };
    let modules = BTreeMap::from([
        ("a.tsx".into(), vec!["leaf.ts".into()]),
        ("b.tsx".into(), vec![]),
        ("leaf.ts".into(), vec![]),
    ]);
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![],
        },
        javascript: JavaScriptCatalogue {
            bindings: ["a.tsx", "b.tsx"]
                .into_iter()
                .map(|module| {
                    (
                        format!("{module}#folder"),
                        ResolvedDefinition {
                            path: module.into(),
                            title: module.into(),
                        },
                    )
                })
                .collect(),
            entries: BTreeMap::new(),
            generation: Some(JavaScriptGeneration {
                modules,
                module_digests: BTreeMap::from([("leaf.ts".into(), Some(value.into()))]),
                lease: lease.map(|lease| lease as Arc<dyn GenerationLease>),
                ..Default::default()
            }),
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        prop_validators: BTreeMap::new(),
        dependency_directories: Default::default(),
        warnings: vec![],
    };
    runtime
        .create(&config)
        .unwrap()
        .prepare(config, catalogue, None)
        .unwrap()
}
