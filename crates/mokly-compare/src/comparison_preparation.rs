//! Independent paired-view inputs without resource memo or parsed CSS access.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_css::match_tree::MatchTree;
use mokly_graph::cache::Artifact;
use mokly_graph::comparison_input::{ComparisonFallback, RetainedComparisonInput};
use mokly_graph::document_codec::EncodedView;
use mokly_graph::types::{ComparisonDocument, RenderGeneration};
use mokly_html::composition::Composed;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_documents;
use crate::comparison_error::CompareResult;
use crate::comparison_resources::{self, Resources};
use crate::error::Result;
use crate::instance_policy::Transparency;
use crate::reuse_generation::RecordingGeneration;
use crate::reuse_probes::Probes;
use crate::reuse_reads::Recorder;
use crate::view_material::MaterialComparison;

/// Owned transient inputs, released after the ordered consumer finishes one view.
pub(crate) struct PreparedView {
    pub(crate) recorder: Option<Arc<Recorder>>,
    /// Base and head artifacts, with no borrowed document fields.
    pub(crate) artifacts: [Option<Arc<Artifact>>; 2],
    /// Validated closures with no relocation aliases yet.
    pub(crate) resources: Resources,
    /// Base and head root matching arenas.
    pub(crate) trees: [Option<Arc<MatchTree>>; 2],
    /// Independent material for a paired view whose entry did not move.
    pub(crate) material: Option<MaterialComparison>,
    /// Exact bytes and retained metadata are equal, with no path projection changes.
    pub(crate) equal_document: bool,
}

/// A worker result either owns completed inputs or defers all source work.
pub(crate) enum ViewInput {
    Ready(Box<PreparedView>),
    Deferred(Option<Box<dyn ComparisonFallback>>),
}

/// Read a paired view without shared comparison caches.
pub(crate) trait ViewPreparation: Send + Sync {
    /// Prepare retained base inputs only. Base Git source reads write a fatal
    /// SourceFailures channel that can replace the returned comparison error.
    /// Deferring all base source IO preserves the set and order of those writes.
    fn retained(&self, before: Option<&str>, after: Option<&str>, moved: bool)
    -> Result<ViewInput>;
    /// Read documents before closures; open a failed restore recipe once, in order.
    fn prepare(
        &self,
        before: Option<&str>,
        after: Option<&str>,
        moved: bool,
        retained: Option<RetainedComparisonInput>,
    ) -> Result<PreparedView>;
}

/// Generation dependencies and accepted path mappings for independent preparation.
pub(crate) struct Preparation<'a> {
    pub(crate) recording: Option<&'a AtomicBool>,
    pub(crate) probes: Option<&'a Arc<Probes>>,
    /// Checked base generation.
    pub(crate) before: &'a dyn RenderGeneration,
    /// Checked head generation.
    pub(crate) after: &'a dyn RenderGeneration,
    /// Accepted entry relocations, fixed before view preparation starts.
    pub(crate) paths: &'a BTreeMap<String, String>,
    pub(crate) transparent: &'a Transparency,
    /// Catalogue pairing preserved every original path spelling.
    pub(crate) paths_preserved: bool,
}

impl ViewPreparation for Preparation<'_> {
    fn retained(
        &self,
        before: Option<&str>,
        after: Option<&str>,
        moved: bool,
    ) -> Result<ViewInput> {
        if let Some(recorder) = self.new_recorder() {
            let previous = RecordingGeneration {
                inner: self.before,
                recorder: &recorder,
                side: ReviewSide::Before,
            };
            let current = RecordingGeneration {
                inner: self.after,
                recorder: &recorder,
                side: ReviewSide::After,
            };
            let input = Preparation {
                before: &previous,
                after: &current,
                paths: self.paths,
                transparent: self.transparent,
                paths_preserved: self.paths_preserved,
                probes: None,
                recording: None,
            }
            .retained(before, after, moved)?;
            return Ok(match input {
                ViewInput::Ready(mut prepared) => {
                    prepared.recorder = Some(recorder);
                    ViewInput::Ready(prepared)
                }
                deferred => deferred,
            });
        }
        if !moved
            && self.paths_preserved
            && before == after
            && let Some(route) = before
            && let Some(evidence) = self.before.retained_document_evidence(route)
        {
            let head = self.after.comparison_document(route).compare()?;
            let equal = EncodedView::comparison_identity(&head).ok() == Some(evidence.identity);
            let retained = if equal {
                Some(RetainedComparisonInput::Ready(ComparisonDocument {
                    artifact: head.clone(),
                    closure: evidence.closure,
                }))
            } else {
                self.before.retained_comparison_input(route)
            };
            return match retained {
                Some(RetainedComparisonInput::Ready(input)) => {
                    let artifacts = [Some(input.artifact.clone()), Some(head)];
                    let resources = comparison_resources::closures(
                        self.before,
                        self.after,
                        before,
                        after,
                        Some(RetainedComparisonInput::Ready(input)),
                    )?;
                    Ok(ViewInput::Ready(Box::new(comparison_documents::prepare(
                        artifacts,
                        resources,
                        [before, after],
                        self.paths,
                        moved,
                        equal,
                        self.transparent,
                    ))))
                }
                Some(RetainedComparisonInput::Deferred(recipe)) => {
                    Ok(ViewInput::Deferred(Some(recipe)))
                }
                None => Ok(ViewInput::Deferred(None)),
            };
        }
        let retained = before.and_then(|route| self.before.retained_comparison_input(route));
        match retained {
            Some(RetainedComparisonInput::Deferred(recipe)) => {
                Ok(ViewInput::Deferred(Some(recipe)))
            }
            None if before.is_some() => Ok(ViewInput::Deferred(None)),
            retained => Ok(ViewInput::Ready(Box::new(
                self.prepare(before, after, moved, retained)?,
            ))),
        }
    }

    fn prepare(
        &self,
        before_route: Option<&str>,
        after_route: Option<&str>,
        moved: bool,
        retained: Option<RetainedComparisonInput>,
    ) -> Result<PreparedView> {
        if let Some(recorder) = self.new_recorder() {
            let previous = RecordingGeneration {
                inner: self.before,
                recorder: &recorder,
                side: ReviewSide::Before,
            };
            let current = RecordingGeneration {
                inner: self.after,
                recorder: &recorder,
                side: ReviewSide::After,
            };
            let fallback = matches!(&retained, Some(RetainedComparisonInput::Deferred(_)));
            let mut prepared = Preparation {
                before: &previous,
                after: &current,
                paths: self.paths,
                transparent: self.transparent,
                paths_preserved: self.paths_preserved,
                probes: None,
                recording: None,
            }
            .prepare(before_route, after_route, moved, retained)?;
            if fallback {
                recorder.invalidate();
            }
            prepared.recorder = Some(recorder);
            return Ok(prepared);
        }
        let before = match (&retained, before_route) {
            (Some(RetainedComparisonInput::Ready(input)), _) => Some(input.artifact.clone()),
            (Some(RetainedComparisonInput::Deferred(recipe)), Some(route)) => {
                Some(recipe.document(route).compare()?)
            }
            (_, Some(route)) => Some(self.before.comparison_document(route).compare()?),
            _ => None,
        };
        let after = after_route
            .map(|route| self.after.comparison_document(route).compare())
            .transpose()?;
        let artifacts = [before, after];
        let resources = comparison_resources::closures(
            self.before,
            self.after,
            before_route,
            after_route,
            retained,
        )?;
        Ok(comparison_documents::prepare(
            artifacts,
            resources,
            [before_route, after_route],
            self.paths,
            moved,
            false,
            self.transparent,
        ))
    }
}

impl Preparation<'_> {
    fn new_recorder(&self) -> Option<Arc<Recorder>> {
        if !self
            .recording
            .is_some_and(|recording| recording.load(Ordering::Acquire))
        {
            return None;
        }
        self.probes.and_then(Recorder::new)
    }
}

/// Borrow composed documents while retaining their owning artifact handles.
pub(crate) fn documents(artifacts: &[Option<Arc<Artifact>>; 2]) -> [Option<&Composed>; 2] {
    [
        artifacts[0].as_ref().map(|artifact| {
            artifact
                .document
                .as_ref()
                .expect("the graph composes a document for every base comparison view plan")
        }),
        artifacts[1].as_ref().map(|artifact| {
            artifact
                .document
                .as_ref()
                .expect("the graph composes a document for every current comparison view plan")
        }),
    ]
}

#[cfg(test)]
#[path = "_tests_/equal_preparation/mod.rs"]
mod equal_preparation_tests;
