//! A view is validated without a document read only after every kept input is proven.

use std::sync::atomic::Ordering;

use mokly_graph::closure::ClosureBuilder;
use mokly_graph::head_validation::{ClosureProof, HeadProof};
use mokly_graph::workers::ValidatedView;

use crate::validation_arena::Replay;
use crate::validation_head::Head;

impl Head {
    /// Prove the link reads, then the closure walk, then adopt the kept document checks.
    pub(crate) fn kept_view(&self, route: &str, builder: &dyn ClosureBuilder) -> HeadProof {
        let unknown = HeadProof::Read(ClosureProof::Unknown);
        let Some(key) = self.key(route) else {
            return unknown;
        };
        self.resident
            .with_optional([self.previous, self.current], |arenas| {
                let Some(previous) = arenas[0] else {
                    return unknown;
                };
                let (Some(fact), Some(outputs)) =
                    (previous.fact(route, key), previous.outputs(route, key))
                else {
                    return unknown;
                };
                let Some(checks) = &fact.checks else {
                    return unknown;
                };
                let replay = Replay {
                    current: arenas[1],
                    resident: &self.resident,
                    generation: self.generation.as_ref(),
                };
                if !outputs
                    .reads
                    .iter()
                    .all(|read| replay.identity(read, Some(read)) == Some(read.identity))
                {
                    return unknown;
                }
                if !replay.closure(&fact, route, builder) {
                    return HeadProof::Read(ClosureProof::Changed);
                }
                if !self.generation.adopt_validation(route, checks) {
                    return unknown;
                }
                if let Some(current) = arenas[1] {
                    current.keep(route, &fact);
                    current.keep_outputs(route, &outputs);
                }
                self.documents.fetch_add(1, Ordering::Relaxed);
                self.reused.fetch_add(1, Ordering::Relaxed);
                self.forward(route, Some(outputs.usage.clone()));
                HeadProof::Kept(ValidatedView {
                    route: route.into(),
                    anchors: outputs.anchors.clone(),
                    links: outputs.links.clone(),
                    closure: fact.closure.files.clone(),
                    warnings: outputs
                        .warnings
                        .iter()
                        .chain(&fact.closure.warnings)
                        .cloned()
                        .collect(),
                })
            })
    }
}
