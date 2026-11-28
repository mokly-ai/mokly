//! Ordered memo, CSS, proof, state, and usage work consumes one prepared view.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;
use std::time::Instant;

use mokly_css::attribution::PageObservation;
use mokly_css::observation;
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::evidence::ViewEvidence;
use mokly_model::namespace;
use mokly_model::review::ReviewState;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_address::address;
use crate::comparison_preparation::{self, PreparedView};
use crate::comparison_resources::{self, ResourceInput};
use crate::comparison_types::{DocumentComparison, ViewKey};
use crate::comparison_views::{ImmutableView, PairViews, PendingView, UsageView};
use crate::error::Result;
use crate::instance_policy::Transparency;
use crate::instance_proof::ProofInput;
use crate::resource_memo::ResourceMemo;
use crate::{inline_styles, instance_proof, owned_styles, view_material};

pub(crate) trait ViewConsumer {
    fn consume(
        &self,
        result: &mut PairViews,
        key: ViewKey,
        before_route: Option<String>,
        after_route: Option<String>,
        prepared: PreparedView,
    ) -> Result<()>;
}

pub(crate) struct Consumer<'a> {
    pub(crate) moved: bool,
    pub(crate) previous: Option<&'a ModelEntry>,
    pub(crate) current: Option<&'a ModelEntry>,
    pub(crate) component: Option<String>,
    pub(crate) paths: &'a BTreeMap<String, String>,
    pub(crate) transparent: &'a Transparency,
    pub(crate) memo: &'a dyn ResourceMemo,
}

impl ViewConsumer for Consumer<'_> {
    fn consume(
        &self,
        result: &mut PairViews,
        key: ViewKey,
        before_route: Option<String>,
        after_route: Option<String>,
        prepared: PreparedView,
    ) -> Result<()> {
        let PreparedView {
            recorder,
            artifacts,
            mut resources,
            trees: [before_tree, after_tree],
            material,
            equal_document,
        } = prepared;
        let [before_document, after_document] = comparison_preparation::documents(&artifacts);
        if self.moved {
            resources.aliases =
                comparison_resources::aliases(&resources.before, &resources.after, self.memo)?;
        }
        result
            .warnings
            .extend(resources.before.warnings.iter().cloned());
        let mut observation = PageObservation {
            component: self.component.clone(),
            ..Default::default()
        };
        let evidence = comparison_resources::evidence(
            ResourceInput {
                resources: &resources,
                memo: self.memo,
                before_tree: before_tree.as_ref(),
                after_tree: after_tree.as_ref(),
                paths: self.paths,
                before_route: &format!(
                    "static/mokly-generated/{}",
                    before_route.as_deref().unwrap_or("")
                ),
                after_route: &format!(
                    "static/mokly-generated/{}",
                    after_route.as_deref().unwrap_or("")
                ),
            },
            &mut observation,
        )?;
        let comparison = match (self.moved, before_document, after_document) {
            (true, Some(left), Some(right)) => Some(view_material::compare(
                left,
                right,
                &format!(
                    "static/mokly-generated/{}",
                    before_route.as_deref().unwrap_or("")
                ),
                &format!(
                    "static/mokly-generated/{}",
                    after_route.as_deref().unwrap_or("")
                ),
                self.paths,
                &resources.aliases,
                self.transparent,
            )),
            _ => material,
        };
        let candidates = match (&comparison, self.previous, self.current) {
            (Some(comparison), Some(_), Some(_)) => comparison.instances.as_slice(),
            _ => &[],
        };
        let mut owned = if equal_document {
            owned_styles::Changes::default()
        } else {
            owned_styles::compare(
                [
                    before_document.map_or(&[], |document| document.tree.as_slice()),
                    after_document.map_or(&[], |document| document.tree.as_slice()),
                ],
                [before_tree.as_deref(), after_tree.as_deref()],
                self.paths,
                &format!(
                    "static/mokly-generated/{}",
                    after_route
                        .as_ref()
                        .or(before_route.as_ref())
                        .map_or("", String::as_str)
                ),
                self.memo,
                candidates,
            )?
        };
        if let Some(comparison) = &comparison {
            owned.prepare(comparison);
        }
        observation.rules.extend(mem::take(&mut owned.rules));
        let inline = if equal_document {
            Vec::new()
        } else {
            let [before_source, after_source] = [&before_route, &after_route]
                .map(|route| namespace::generated(route.as_deref().unwrap_or("")));
            inline_styles::compare(
                before_document.map(|document| document.tree.as_slice()),
                after_document.map(|document| document.tree.as_slice()),
                before_tree.as_deref(),
                after_tree.as_deref(),
                [&before_source, &after_source],
                &format!(
                    "static/mokly-generated/{}",
                    after_route
                        .as_ref()
                        .or(before_route.as_ref())
                        .map_or("", String::as_str)
                ),
                self.memo,
            )?
        };
        observation.rules.extend(inline);
        observation.rules = observation::merge(mem::take(&mut observation.rules));
        let proofs = match (&comparison, self.previous, self.current) {
            (Some(comparison), Some(_), Some(_)) => instance_proof::collect(ProofInput {
                comparison,
                resources: &resources,
                evidence: &evidence,
                paths: self.paths,
            }),
            _ => Vec::new(),
        };
        let state = match &comparison {
            None if before_document.is_none() => ReviewState::Added,
            None => ReviewState::Removed,
            Some(comparison) if comparison.changed => ReviewState::Changed,
            Some(comparison) if comparison.ignored_only => ReviewState::IgnoredOnly,
            _ => ReviewState::Unchanged,
        };
        let ignored_ids = comparison
            .as_ref()
            .map_or_else(Vec::new, |comparison| comparison.ignored_ids.clone());
        result.views.push(PendingView::new(Arc::new(ImmutableView {
            document: DocumentComparison {
                key,
                before_route,
                after_route,
                state,
                ignored_ids,
                evidence: ViewEvidence {
                    rules: Vec::new(),
                    resources: evidence,
                },
            },
            observation,
            material: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.changed),
            inputs: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.inputs),
            structure: comparison
                .as_ref()
                .is_some_and(|comparison| comparison.structure),
            proofs,
            owned,
            // A view on one side proves a root change only for a one-sided
            // entry; an entry with both sides that gains or loses a view has
            // no paired canonical form for that view.
            root_changed: comparison.as_ref().map_or(
                self.previous.is_none() || self.current.is_none(),
                |comparison| comparison.root_changed,
            ),
        })));
        let usage_started = Instant::now();
        {
            for (side, entry, document) in [
                (ReviewSide::Before, self.previous, before_document),
                (ReviewSide::After, self.current, after_document),
            ] {
                if let (Some(entry), Some(document)) = (entry, document) {
                    result.usage.push(UsageView {
                        side,
                        entry: address(entry),
                        component: matches!(entry.content, EntryContent::Component { .. }),
                        key,
                        usage: document.usage.clone(),
                    });
                }
            }
        }
        if let Some(recorder) = recorder {
            recorder.usage(usage_started.elapsed().as_nanos() as u64);
        }
        Ok(())
    }
}
