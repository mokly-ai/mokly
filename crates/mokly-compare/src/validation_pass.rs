//! The background walk of the same generation replaces a classification walk.

use mokly_graph::closure::ClosureBuilder;
use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::head_validation::{ClosureFacts, DocumentChecks};
use mokly_graph::head_walks::{WalkRecord, WalkStep};

use crate::validation_head::Head;

impl Head {
    /// Replay a background walk in walk order, through the current identities and the
    /// lexical observer, and keep it as this view's fact. A changed read declines it.
    pub(crate) fn replay_pass(
        &self,
        route: &str,
        key: Option<ContentIdentity>,
        pass: WalkRecord,
        builder: &dyn ClosureBuilder,
        checks: Option<DocumentChecks>,
    ) -> Option<ClosureFacts> {
        self.resident.with_optional([self.current, None], |arenas| {
            let arena = arenas[0];
            if let Some(arena) = arena {
                arena.begin(&self.resident, route);
            }
            for step in &pass.steps {
                match step {
                    WalkStep::Read(kind, read, identity) => {
                        let current = match arena {
                            Some(arena) => {
                                let current = arena.input(
                                    &self.resident,
                                    self.generation.as_ref(),
                                    *kind,
                                    read,
                                    None,
                                );
                                let same = current.as_ref().map(|read| read.identity);
                                arena.record(route, current);
                                same
                            }
                            None => self.generation.validation_identity(*kind, read),
                        };
                        if current != Some(*identity) {
                            return None;
                        }
                    }
                    WalkStep::Observe(path) => {
                        builder.observe(route, path);
                        if let Some(arena) = arena {
                            arena.observe(route, path);
                        }
                    }
                }
            }
            let closure = ClosureFacts {
                files: pass.closure.files,
                warnings: pass.closure.warnings,
                replay: Vec::new(),
            };
            if let Some(arena) = arena {
                arena.finish(route, key, &closure, checks);
            }
            Some(closure)
        })
    }
}
