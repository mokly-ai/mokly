//! A view is validated without a document read only after every kept input is proven.

use std::sync::atomic::Ordering;

use mokly_graph::closure::ClosureBuilder;
use mokly_graph::error::Result;
use mokly_graph::head_validation::{ClosureProof, HeadProof};
use mokly_graph::workers::ValidatedView;

use crate::validation_arena::Replay;
use crate::validation_head::Head;

impl Head {
    /// Prove the link reads, then the closure walk, then adopt the kept document checks.
    pub(crate) fn kept_view(&self, route: &str, builder: &dyn ClosureBuilder) -> Result<HeadProof> {
        let unknown = HeadProof::Read(ClosureProof::Unknown);
        let Some(key) = self.key(route) else {
            return Ok(unknown);
        };
        self.resident
            .with_optional([self.previous, self.current], |arenas| {
                let Some(previous) = arenas[0] else {
                    return Ok(unknown);
                };
                let (Some(fact), Some(outputs)) =
                    (previous.fact(route, key), previous.outputs(route, key))
                else {
                    return Ok(unknown);
                };
                let Some(checks) = &fact.checks else {
                    return Ok(unknown);
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
                    return Ok(unknown);
                }
                if !replay.closure(&fact, route, builder)? {
                    return Ok(HeadProof::Read(ClosureProof::Changed));
                }
                if !self.generation.adopt_validation(route, checks) {
                    return Ok(unknown);
                }
                if let Some(current) = arenas[1] {
                    current.keep(route, &fact);
                    current.keep_outputs(route, &outputs);
                }
                self.documents.fetch_add(1, Ordering::Relaxed);
                self.reused.fetch_add(1, Ordering::Relaxed);
                self.forward(route, Some(outputs.usage.clone()));
                Ok(HeadProof::Kept(ValidatedView {
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
                }))
            })
    }
}
