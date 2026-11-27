//! Construct one generation while retaining its resource leases and prepared evidence.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use crate::graph::Graph;
use crate::link_index::LinkIndex;
use crate::link_results::{self, MemoryLinkResults};
use crate::reference_index::MemoryReferenceIndex;
use crate::requests::MemoryRequests;
use crate::session::{Session, SessionInput, State};
use crate::session_proof;

impl Session {
    pub(crate) fn new(graph: &Graph, input: SessionInput) -> Self {
        let comparison_policy = session_proof::policy(&input);
        let link_index = LinkIndex::new(&input.plans, &input.catalogue.model.entries);
        for plan in input.plans.values() {
            graph.inputs.resources.retain(&plan.resource_key);
            graph.inputs.closures.retain(&plan.key.0);
        }
        let document_keys = input
            .plans
            .values()
            .map(|plan| plan.key.0.clone())
            .collect();
        Self {
            state: Arc::new(State {
                prefetch: Mutex::new(None),
                fresh: Mutex::new(BTreeMap::new()),
                walks: Default::default(),
                anchor_flights: Arc::new(MemoryRequests::default()),
                link_results: Arc::new(MemoryLinkResults::new(link_results::LIMIT)),
                link_index,
                observed: Arc::new(Mutex::new(
                    input
                        .plans
                        .values()
                        .flat_map(|plan| {
                            graph.inputs.resources.paths(&plan.resource_key).into_keys()
                        })
                        .collect(),
                )),
                observer: Arc::new(Mutex::new(None)),
                generation_key: input.generation_key,
                directories: input.directories,
                stylesheet_imports: input.stylesheet_imports,
                stylesheet_resolution_files: input.stylesheet_resolution_files,
                stylesheet_resolution_roots: input.stylesheet_resolution_roots,
                document_keys,
                matchers: Arc::new(input.matchers),
                reference_index: Arc::new(MemoryReferenceIndex::new(
                    graph.inputs.style_references.clone(),
                )),
                inputs: graph.inputs.clone(),
                config: Arc::new(input.config),
                catalogue: Arc::new(input.catalogue),
                plans: Arc::new(input.plans),
                resources: Arc::new(input.resources),
                tree: graph.tree.clone(),
                composer: graph.composer.clone(),
                stylesheets: graph.stylesheets.clone(),
                cache: graph.cache.clone(),
                workers: graph.workers.clone(),
                policy: input.policy,
                comparison_policy,
            }),
        }
    }
}
