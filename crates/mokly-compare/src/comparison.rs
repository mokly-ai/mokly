//! One catalogue-wide comparison engine for build, Serve, and static projection.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_css::attribution::{self, PageObservation};
use mokly_css::parsed_cache::ParsedCssCache;
use mokly_graph::types::RenderGeneration;
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{CatalogueModel, EntryContent};
use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{EntryChangeReason, ReviewDiagnostic, ReviewResultV8, ReviewState};
use mokly_model::review_order;

use crate::comparison_error::CompareResult;
use crate::comparison_types::{
    Comparison, ComparisonCounts, ComparisonRequest, ComparisonResult, EntryClassification,
};
use crate::comparison_views;
use crate::error::Result;
use crate::material::mapped;
use crate::move_context::RenderedMoves;
use crate::move_inventory;
use crate::move_types::MoveDetector;
use crate::source_validation::SourceValidation;
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
        let base_summary = before.render_all().compare()?;
        let before_plans = move_inventory::index(before.as_ref());
        let after_plans = move_inventory::index(after.as_ref());
        let pairing = self.moves.pair(
            before_model,
            after_model,
            &RenderedMoves::new(before.clone(), after.clone(), &before_plans, &after_plans),
        )?;
        let paths = pairing.paths(before_model, after_model);
        let mut pairs = Vec::new();
        let mut warnings = base_summary.warnings;
        let mut observations: Vec<PageObservation> = Vec::new();
        for pair in &pairing.entries {
            let views = comparison_views::collect(
                pair,
                before.clone(),
                after.clone(),
                &paths,
                self.css.as_ref(),
                &before_plans,
                &after_plans,
            )?;
            warnings.extend(views.warnings.iter().cloned());
            observations.extend(views.views.iter().map(|view| view.observation.clone()));
            pairs.push(views);
        }
        let attributed = attribution::attribute(&observations);
        let mut impact = attributed.changed_components;
        let mut instance_impact = BTreeSet::new();
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
                view.document.evidence.rules = attributed.pages[index].clone();
                instance_impact.extend(view.instance_impact.iter().cloned());
                if let Some(component) = &component
                    && view.root_changed
                    && same_inputs
                {
                    impact.insert(component.clone());
                }
                for resource in &view.document.evidence.resources {
                    if let EvidenceOwner::Component { path } = &resource.owner
                        && (Some(path) != component.as_ref() || same_inputs)
                    {
                        impact.insert(path.clone());
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
        impact.extend(instance_impact.iter().cloned());
        include_instance_impact(&mut entries, &instance_impact);
        propagate(
            &mut entries,
            &pairing.entries,
            before_model,
            after_model,
            &paths,
        );
        let affected = affected::collect(&usages, &impact, &pairing, before_model, after_model);
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
        source_validation::validate(
            &review,
            SourceValidation {
                before: before_model,
                after: after_model,
                pairing: &pairing,
                classifications: &entries,
                usage: &usages,
                impact: &impact,
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
                .flat_map(|entry| &entry.documents)
                .filter(|view| view.state == ReviewState::IgnoredOnly)
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

fn include_instance_impact(entries: &mut [EntryClassification], impact: &BTreeSet<String>) {
    for entry in entries {
        if entry.kind == EntryKind::Component && impact.contains(&entry.path) && !entry.included {
            entry.included = true;
            entry.state = ReviewState::Changed;
            entry.reasons.push(EntryChangeReason::Material);
        }
    }
}

fn propagate(
    entries: &mut [EntryClassification],
    pairs: &[crate::move_types::EntryPair],
    before: &CatalogueModel,
    after: &CatalogueModel,
    paths: &BTreeMap<String, String>,
) {
    let changed_screens: BTreeSet<_> = entries
        .iter()
        .filter(|entry| entry.kind == EntryKind::Screen && !entry.reasons.is_empty())
        .map(|entry| entry.path.clone())
        .collect();
    for (classification, pair) in entries.iter_mut().zip(pairs) {
        if classification.kind != EntryKind::UseCase {
            continue;
        }
        let mut screens = BTreeSet::new();
        for (catalogue, index, paths) in [
            (before, pair.before, paths),
            (after, pair.after, &BTreeMap::new()),
        ] {
            if let Some(index) = index
                && let EntryContent::UseCase { steps } = &catalogue.entries[index].content
            {
                for step in steps {
                    let path = mapped(&step.screen_path, paths);
                    if changed_screens.contains(&path) {
                        screens.insert(path);
                    }
                }
            }
        }
        if !screens.is_empty() {
            classification.included = true;
            if pair.before.is_some() && pair.after.is_some() {
                classification.state = ReviewState::Changed;
            }
            classification.reasons.extend(
                screens
                    .into_iter()
                    .map(|screen_path| EntryChangeReason::Screen { screen_path }),
            );
        }
    }
}
