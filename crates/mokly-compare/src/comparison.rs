//! One catalogue-wide comparison engine for build, Serve, and static projection.

use std::sync::Arc;

use mokly_css::attribution::{self, PageObservation};
use mokly_css::parsed_cache::ParsedCssCache;
use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::EntryContent;
use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{ReviewDiagnostic, ReviewResultV8, ReviewState};
use mokly_model::review_order;

use crate::comparison_error::CompareResult;
use crate::comparison_types::{Comparison, ComparisonCounts, ComparisonRequest, ComparisonResult};
use crate::comparison_views;
use crate::error::Result;
use crate::implementation::{self, InlineProof, OwnImpact};
use crate::move_context::RenderedMoves;
use crate::move_inventory;
use crate::move_types::MoveDetector;
use crate::resource_memo::{Memo, ResourceMemo};
use crate::source_validation::SourceValidation;
use crate::use_case_impact;
use crate::{
    affected, entry_classification, review_projection, root_impact, snapshots, source_validation,
};

/// Injected move policy and byte-bounded parse cache. It retains no parsed view set.
pub struct Engine {
    /// Deterministic kind-aware move detector.
    pub moves: Arc<dyn MoveDetector>,
    /// Parsed stylesheets shared by content across both sides and every path.
    pub css: Arc<dyn ParsedCssCache>,
}

impl Comparison for Engine {
    fn compare(
        &self,
        request: &ComparisonRequest,
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult> {
        let before_model = &before.catalogue().model;
        let after_model = &after.catalogue().model;
        before.render_all().compare()?;
        after.render_all().compare()?;
        let memo: Arc<dyn ResourceMemo> = Arc::new(Memo::new(
            before.clone(),
            after.clone(),
            self.css.clone(),
            16 * 1024 * 1024,
        ));
        let before_plans = move_inventory::index(before.as_ref());
        let after_plans = move_inventory::index(after.as_ref());
        let pairing = self.moves.pair(
            before_model,
            after_model,
            &RenderedMoves::new(
                before.clone(),
                after.clone(),
                &before_plans,
                &after_plans,
                memo.clone(),
            ),
        )?;
        let paths = pairing.paths(before_model, after_model);
        let mut pairs = Vec::new();
        let mut warnings: Vec<_> = before
            .catalogue()
            .warnings
            .iter()
            .filter(|warning| warning.code == "base-dependencies")
            .cloned()
            .collect();
        let mut observations: Vec<PageObservation> = Vec::new();
        for pair in &pairing.entries {
            let views = comparison_views::collect(
                pair,
                before.clone(),
                after.clone(),
                &paths,
                memo.as_ref(),
                &before_plans,
                &after_plans,
            )?;
            warnings.extend(views.warnings.iter().cloned());
            observations.extend(views.views.iter().map(|view| view.observation.clone()));
            pairs.push(views);
        }
        let attributed = attribution::attribute(&observations);
        let mut impact = attributed.changed_components;
        let mut instance_proofs = Vec::new();
        let mut inline_proofs = Vec::new();
        let mut own_impact = OwnImpact::default();
        let mut index = 0;
        let mut usages = Vec::new();
        let mut entries = Vec::new();
        for (pair, mut views) in pairing.entries.iter().zip(pairs) {
            let previous = pair.before.map(|index| &before_model.entries[index]);
            let current = pair.after.map(|index| &after_model.entries[index]);
            let entry = current.or(previous);
            let component = entry.and_then(|entry| {
                matches!(entry.content, EntryContent::Component { .. }).then(|| {
                    entry
                        .metadata
                        .variant_of
                        .as_ref()
                        .unwrap_or(&entry.metadata.path)
                        .clone()
                })
            });
            let same_inputs = root_impact::allows(
                previous,
                current,
                before.catalogue(),
                after.catalogue(),
                &paths,
            )?;
            for view in &mut views.views {
                view.document
                    .evidence
                    .rules
                    .extend(attributed.pages[index].clone());
                instance_proofs.append(&mut view.proofs);
                for component in &view.inline_components {
                    impact.insert(component.clone());
                    for rule in &view.document.evidence.rules {
                        if matches!(&rule.owner, EvidenceOwner::Component { path } if path == component)
                        {
                            inline_proofs.push(InlineProof {
                                component: component.clone(),
                                context: entry
                                    .map_or("", |entry| entry.metadata.path.as_str())
                                    .into(),
                                view: view.document.key,
                                rule: rule.clone(),
                            });
                        }
                    }
                }
                if let Some(component) = &component
                    && view.root_changed
                    && same_inputs
                {
                    impact.insert(component.clone());
                    own_impact.render.insert(component.clone());
                }
                for resource in &view.document.evidence.resources {
                    if let EvidenceOwner::Component { path } = &resource.owner
                        && Some(path) == component.as_ref()
                        && same_inputs
                    {
                        impact.insert(path.clone());
                        own_impact
                            .dependencies
                            .insert((path.clone(), resource.path.clone()));
                    }
                }
                for rule in &view.document.evidence.rules {
                    if let EvidenceOwner::Component { path } = &rule.owner
                        && Some(path) == component.as_ref()
                    {
                        own_impact
                            .dependencies
                            .insert((path.clone(), rule.stylesheet.clone()));
                    }
                }
                let direct = attributed.component_pages.contains(&index)
                    || view.document.evidence.rules.iter().any(|rule| rule.owner == EvidenceOwner::Entry && rule.status != RuleStatus::Excluded)
                    || view.document.evidence.resources.iter().any(|resource| resource.owner == EvidenceOwner::Entry || matches!(&resource.owner, EvidenceOwner::Component { path } if Some(path) == component.as_ref()));
                if direct
                    && matches!(
                        view.document.state,
                        ReviewState::Unchanged | ReviewState::IgnoredOnly
                    )
                {
                    view.document.state = ReviewState::Changed;
                }
                index += 1;
            }
            usages.append(&mut views.usage);
            entries.push(entry_classification::classify(
                pair,
                views,
                before_model,
                after_model,
                &paths,
            )?);
        }
        impact.extend(instance_proofs.iter().map(|proof| proof.component.clone()));
        implementation::include(&mut entries, &instance_proofs, &inline_proofs, &own_impact);
        use_case_impact::propagate(
            &mut entries,
            &pairing.entries,
            before_model,
            after_model,
            &paths,
        );
        let (affected, affected_lookups) =
            affected::collect(&usages, &impact, &pairing, before_model, after_model);
        let mut review = ReviewResultV8 {
            schema_version: 8,
            base_commit: request.base_commit.clone(),
            entries: review_projection::entries(&entries, &pairing, before_model, after_model),
            affected,
            diagnostics: pairing
                .diagnostics
                .iter()
                .map(|message| ReviewDiagnostic {
                    message: message.clone(),
                })
                .collect(),
        };
        review_order::normalize(&mut review).compare()?;
        let validation_lookups = source_validation::validate(
            &review,
            SourceValidation {
                before: before_model,
                after: after_model,
                pairing: &pairing,
                classifications: &entries,
                usage: &usages,
                impact: &impact,
                instance_proofs: &instance_proofs,
                inline_proofs: &inline_proofs,
            },
        )?;
        let snapshot = snapshots::create(
            &request.catalogue_identity,
            &request.base_ref,
            &request.base_commit,
            before_model,
            after_model,
            &pairing,
            &entries,
        )?;
        let counts = ComparisonCounts {
            changes: snapshot.changed_entries.len(),
            moved: pairing.moves.len(),
            ignored_only: entries
                .iter()
                .filter(|entry| entry.state == ReviewState::IgnoredOnly)
                .count(),
        };
        tracing::debug!(
            changes = counts.changes,
            moved = counts.moved,
            ignored_only = counts.ignored_only,
            "comparison ready"
        );
        mokly_catalogue::diagnostic::normalize_warnings(&mut warnings);
        Ok(ComparisonResult {
            resource_work: memo.work(),
            affected_lookups,
            validation_lookups,
            warnings,
            review,
            snapshot,
            entries,
            pairing,
            counts,
            before,
            after,
        })
    }
}
