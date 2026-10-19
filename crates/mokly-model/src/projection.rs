//! Allowlisted current catalogue projection for Serve and static output.

use std::collections::BTreeMap;

use crate::axes::{ColorScheme, Viewport};
use crate::catalogue::{CatalogueModel, EntryContent};
use crate::error::{InternalError, Result};
use crate::material::digest;
use crate::public_detail::{DetailEntry, DetailView, EntryDetailV1};
use crate::public_index::{CatalogueReadModel, LiveGeneration};
use crate::public_metadata::{CatalogueIdentity, ChangesStatus};
use crate::public_records::*;
use crate::usage::CatalogueUsage;
use crate::{projection_records, projection_tree, versions};

/// Document inputs known before the first render.
#[derive(Clone, Debug)]
pub struct ViewKey {
    /// Complete entry path.
    pub path: String,
    /// Absent for a page or Markdown document.
    pub viewport: Option<Viewport>,
    /// Effective document scheme.
    pub color_scheme: ColorScheme,
    /// Document node input hash.
    pub key: String,
}

/// One publication's identity and availability.
pub struct Publication {
    /// Repository-relative configuration path.
    pub config_path: String,
    /// Process or static deployment identity.
    pub deployment_id: String,
    /// One publication counter.
    pub revision: u64,
    /// Configured comparison ref.
    pub base: Option<String>,
    /// Availability without invented change evidence.
    pub changes_status: ChangesStatus,
    /// Present only in local Serve.
    pub live_generation: Option<String>,
}

/// Project a validated model without private source or render evidence.
pub fn index(
    model: &CatalogueModel,
    keys: &[ViewKey],
    state: &Publication,
) -> Result<CatalogueReadModel> {
    let preimage = serde_json::to_vec(&("mokly-catalogue-v1", &state.config_path));
    let bytes = match preimage {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    let by_path = key_index(keys);
    let mut result = CatalogueReadModel {
        schema_version: versions::CATALOGUE_INDEX,
        identity: CatalogueIdentity {
            id: digest(&bytes),
            title: "Mokly".into(),
        },
        deployment_id: state.deployment_id.clone(),
        revision: state.revision,
        base: state.base.clone(),
        live: state
            .live_generation
            .as_ref()
            .map(|generation| LiveGeneration {
                generation: generation.clone(),
            }),
        changes_status: state.changes_status,
        comparison_url: None,
        tree: projection_tree::build(model),
        tree_order: model
            .folders
            .iter()
            .find(|folder| folder.path.is_empty())
            .and_then(|folder| folder.order.clone()),
        screens: Vec::new(),
        components: Vec::new(),
        pages: Vec::new(),
        documents: Vec::new(),
        use_cases: Vec::new(),
        removed_entries: Vec::new(),
    };
    for entry in &model.entries {
        let common = projection_records::metadata(entry, state.changes_status);
        let mut entry_keys = by_path
            .get(entry.metadata.path.as_str())
            .cloned()
            .unwrap_or_default();
        entry_keys.sort_by_key(|key| (key.viewport, key.color_scheme));
        match &entry.content {
            EntryContent::Screen {
                visual,
                address,
                use_case_paths,
            } => result.screens.push(CatalogueScreen {
                kind: CatalogueScreenKind::Value,
                entry: common,
                visual: projection_records::visual(visual, &entry_keys, state.changes_status),
                address: address.clone(),
                variant_of: entry.metadata.variant_of.clone(),
                use_case_paths: use_case_paths.clone(),
            }),
            EntryContent::Component {
                visual,
                slots,
                supplied_slots,
                ..
            } => result.components.push(CatalogueComponent {
                kind: CatalogueComponentKind::Value,
                entry: common,
                visual: projection_records::visual(visual, &entry_keys, state.changes_status),
                variant_of: entry.metadata.variant_of.clone(),
                slots: slots.clone(),
                supplied_slots: supplied_slots.clone(),
                comparison: projection_records::comparison(state.changes_status),
            }),
            EntryContent::Page => result.pages.push(CataloguePage {
                kind: CataloguePageKind::Value,
                entry: common,
                document_key: entry_keys
                    .first()
                    .map_or_else(String::new, |key| key.key.clone()),
            }),
            EntryContent::Document { color_schemes, .. } => {
                result.documents.push(CatalogueDocument {
                    kind: CatalogueDocumentKind::Value,
                    entry: common,
                    color_schemes: color_schemes.clone(),
                    document_keys: entry_keys
                        .iter()
                        .map(|key| DocumentKey {
                            color_scheme: key.color_scheme,
                            document_key: key.key.clone(),
                        })
                        .collect(),
                })
            }
            EntryContent::UseCase { steps } => result.use_cases.push(CatalogueUseCase {
                kind: CatalogueUseCaseKind::Value,
                entry: common,
                steps: steps.clone(),
            }),
        }
    }
    Ok(result)
}

/// Build every current detail under the same identity and revision fence.
/// Unrendered usage stays pending until a later publication replaces it.
pub fn pending_details(
    model: &CatalogueModel,
    index: &CatalogueReadModel,
    keys: &[ViewKey],
) -> BTreeMap<String, EntryDetailV1> {
    let by_path = key_index(keys);
    model
        .entries
        .iter()
        .map(|entry| {
            let mut views: Vec<_> = by_path
                .get(entry.metadata.path.as_str())
                .into_iter()
                .flatten()
                .filter_map(|key| {
                    key.viewport.map(|viewport| DetailView {
                        viewport,
                        color_scheme: key.color_scheme,
                        usage: CatalogueUsage::Pending,
                        resource_evidence: None,
                    })
                })
                .collect();
            views.sort_by_key(|view| (view.viewport, view.color_scheme));
            (
                entry.metadata.path.clone(),
                EntryDetailV1 {
                    schema_version: versions::ENTRY_DETAIL,
                    identity: index.identity.clone(),
                    deployment_id: Some(index.deployment_id.clone()),
                    revision: Some(index.revision),
                    generation: None,
                    entry: DetailEntry {
                        path: entry.metadata.path.clone(),
                        kind: entry.content.kind(),
                        snapshot_id: None,
                    },
                    views,
                    reasons: None,
                    resource_evidence: None,
                    workspace: None,
                },
            )
        })
        .collect()
}

fn key_index(keys: &[ViewKey]) -> BTreeMap<&str, Vec<&ViewKey>> {
    let mut result: BTreeMap<&str, Vec<&ViewKey>> = BTreeMap::new();
    for key in keys {
        result.entry(&key.path).or_default().push(key);
    }
    result
}
