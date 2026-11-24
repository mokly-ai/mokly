//! Compose shared usage, comparison evidence, and workspace projections for Serve.
//! A detail whose inputs equal the record of its publication kind shares that record.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::projection_detail::{EntryEvidence, Evidence};
use mokly_compare::projection_workspace::WorkspaceProjection;
use mokly_model::namespace::viewer;
use mokly_model::projection;
use mokly_model::projection_usage;
use mokly_model::public_detail::{DetailView, EntryDetailV4, Workspace};
use mokly_model::public_index::CatalogueReadModel;

use crate::comparison_metadata::compared;
use crate::detail_encoding::DetailEncoder;
use crate::detail_publication::PublicationKind;
use crate::error::Result;
use crate::snapshot::Snapshot;

/// The values that one Changes publication writes into a detail.
struct Inputs<'a> {
    workspace: Option<Workspace>,
    evidence: EntryEvidence<'a>,
}

/// Publish every detail of `next`, whose details and files are still those of its origin.
pub(crate) fn apply(next: &mut Snapshot, encoder: &dyn DetailEncoder) -> Result<()> {
    let sources = std::mem::take(&mut next.details);
    let changes = next.changes.clone();
    let kind = if changes.is_some() {
        PublicationKind::ChangesEvidence
    } else {
        PublicationKind::ChangesStatus
    };
    let result = changes.as_ref().map(|accepted| &accepted.result);
    let inputs = inputs(&sources, &next.index, result)?;
    let revision = next.index.revision;
    for ((path, source), inputs) in sources.into_iter().zip(inputs) {
        let Inputs {
            workspace,
            evidence,
        } = inputs;
        let route = viewer(&format!("entries/{path}.json"));
        let shared = next
            .recent_details
            .record(&source.entry.path, kind)
            .filter(|(record, _)| builds(record, &source, workspace.as_ref(), &evidence))
            .map(|(record, file)| (record.clone(), file.clone()));
        let (detail, file) = match shared {
            Some(shared) => shared,
            None => {
                let mut detail = Arc::new(rebuilt(&source, workspace, evidence, revision));
                let adjacent = next.files.get(&route).map(|file| (&source, file));
                let file = next
                    .recent_details
                    .publish(kind, &mut detail, adjacent, encoder)?;
                (detail, file)
            }
        };
        projection::set_detail_id(&mut next.index, &path, &detail.detail_id);
        next.files.insert(route, file);
        next.details.insert(path, detail);
    }
    Ok(())
}

/// Project the inputs of every detail before any is published, so a failed projection
/// publishes nothing.
fn inputs<'a>(
    sources: &BTreeMap<String, Arc<EntryDetailV4>>,
    index: &CatalogueReadModel,
    result: Option<&'a ComparisonResult>,
) -> Result<Vec<Inputs<'a>>> {
    let references = sources
        .iter()
        .map(|(path, detail)| (path.clone(), detail.as_ref()))
        .collect();
    let mut usage = projection_usage::workspaces(&references, index);
    let projections =
        result.map(|result| (Evidence::new(result), WorkspaceProjection::new(result)));
    sources
        .iter()
        .map(|(path, source)| {
            let workspace = usage.remove(path);
            Ok(match &projections {
                Some((evidence, workspaces)) => Inputs {
                    workspace: compared(workspaces.workspace(path, source, workspace))?,
                    evidence: evidence.entry(path, source),
                },
                None => Inputs {
                    workspace,
                    evidence: EntryEvidence::default(),
                },
            })
        })
        .collect()
}

/// Whether `record` equals the detail that `rebuilt` makes from `source` and its inputs,
/// apart from its `detailId` and the revision that each publication stamps.
fn builds(
    record: &EntryDetailV4,
    source: &EntryDetailV4,
    workspace: Option<&Workspace>,
    evidence: &EntryEvidence<'_>,
) -> bool {
    record.revision.is_some()
        && record.workspace.as_ref() == workspace
        && evidence.matches(record)
        && (std::ptr::eq(record, source) || same_source(record, source))
}

/// Whether the fields that a Changes publication keeps from its source are equal.
fn same_source(record: &EntryDetailV4, source: &EntryDetailV4) -> bool {
    let EntryDetailV4 {
        schema_version,
        identity,
        detail_id: _,
        revision: _,
        entry,
        reasons: _,
        before: _,
        views,
        control_order,
        resource_evidence: _,
        workspace: _,
    } = record;
    *schema_version == source.schema_version
        && identity == &source.identity
        && entry == &source.entry
        && control_order == &source.control_order
        && views.len() == source.views.len()
        && views.iter().zip(&source.views).all(|(view, source)| {
            let DetailView {
                viewport,
                color_scheme,
                usage,
                state: _,
                ignored_ids: _,
                resource_evidence: _,
            } = view;
            *viewport == source.viewport
                && *color_scheme == source.color_scheme
                && usage == &source.usage
        })
}

/// The source without its earlier Changes projection, with this publication's inputs.
fn rebuilt(
    source: &EntryDetailV4,
    workspace: Option<Workspace>,
    evidence: EntryEvidence<'_>,
    revision: u64,
) -> EntryDetailV4 {
    let EntryDetailV4 {
        schema_version,
        identity,
        detail_id,
        revision: _,
        entry,
        reasons: _,
        before: _,
        views,
        control_order,
        resource_evidence: _,
        workspace: _,
    } = source;
    let views = views
        .iter()
        .map(|view| {
            let DetailView {
                viewport,
                color_scheme,
                usage,
                state: _,
                ignored_ids: _,
                resource_evidence: _,
            } = view;
            DetailView {
                viewport: *viewport,
                color_scheme: *color_scheme,
                usage: usage.clone(),
                state: None,
                ignored_ids: None,
                resource_evidence: None,
            }
        })
        .collect();
    let mut detail = EntryDetailV4 {
        schema_version: *schema_version,
        identity: identity.clone(),
        detail_id: detail_id.clone(),
        revision: Some(revision),
        entry: entry.clone(),
        reasons: None,
        before: None,
        views,
        control_order: control_order.clone(),
        resource_evidence: None,
        workspace,
    };
    evidence.apply(&mut detail);
    detail
}

#[cfg(test)]
#[path = "_tests_/changes_detail_tests.rs"]
mod changes_detail_tests;
