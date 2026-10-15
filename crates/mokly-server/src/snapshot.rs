//! Atomic public snapshot bytes and declared shell routes.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use mokly_model::canonical;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::namespace::viewer;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_detail::EntryDetailV1;
use mokly_model::public_detail::{LiveDescriptorV3, RenderCapability};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::readers;
use mokly_model::usage_schemas::UsageSchemas;

use crate::assets::File;
use crate::backend::Documents;
use crate::error::{InternalError, Result};
use crate::evidence::{Completion, RenderRoute};
use crate::revision::{RenderLease, RevisionLease};
use crate::stub;

/// One immutable publication; replacement swaps this whole value.
#[derive(Clone)]
pub struct Snapshot {
    /// Current parsed details for atomic evidence publications.
    pub details: BTreeMap<String, EntryDetailV1>,
    /// Work in catalogue and view order, independent of request order.
    pub routes: Vec<RenderRoute>,
    /// Completed usage without retaining document trees or bytes.
    pub completed: BTreeMap<String, Completion>,
    /// Validity of live work admitted under this revision.
    pub lease: Arc<dyn RenderLease>,
    /// Matching immutable render and public-file backend for this publication.
    pub documents: Arc<dyn Documents>,
    /// Parsed index for render and detail context.
    pub index: CatalogueReadModel,
    /// All JSON and package asset response bytes.
    pub files: BTreeMap<String, File>,
    /// Validated current entry identities.
    pub entries: BTreeSet<String>,
    /// Identical data-free HTML on all shell routes.
    pub stub: Vec<u8>,
    /// Secret capability, never stored in index or detail bytes.
    pub render_token: String,
}

/// Purely projected state plus per-process identities.
pub struct SnapshotInput {
    /// Matching render and public-file backend.
    pub documents: Arc<dyn Documents>,
    /// Publication revision, starting at one in Serve.
    pub revision: u64,
    /// Configuration identity relative to the repository root.
    pub config_path: String,
    /// Configured base, without starting Git work.
    pub base: Option<String>,
    /// Loaded package assets.
    pub assets: BTreeMap<String, File>,
}

/// Publication factory, consumed through a trait at the CLI composition root.
#[cfg_attr(test, unimock::unimock(api = SnapshotFactoryMock))]
pub trait SnapshotFactory: Send + Sync {
    /// Build one complete publication without rendering any document.
    fn create(
        &self,
        generation: Arc<dyn RenderGeneration>,
        input: SnapshotInput,
    ) -> Result<Arc<Snapshot>>;
}

/// Initial Serve publication factory, reused for source replacements.
pub struct Projector {
    /// Deployment identity chosen once at the process composition root.
    pub deployment_id: String,
    /// Render capability chosen once at the process composition root.
    pub render_token: String,
}

impl SnapshotFactory for Projector {
    fn create(
        &self,
        generation: Arc<dyn RenderGeneration>,
        input: SnapshotInput,
    ) -> Result<Arc<Snapshot>> {
        let keys: Vec<_> = generation
            .plans()
            .values()
            .map(|plan| ViewKey {
                path: generation.catalogue().model.entries[plan.entry]
                    .metadata
                    .path
                    .clone(),
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
                key: plan.key.0.clone(),
            })
            .collect();
        let live_generation = generation.generation_key().to_owned();
        let state = Publication {
            config_path: input.config_path,
            deployment_id: self.deployment_id.clone(),
            revision: input.revision,
            base: input.base,
            changes_status: ChangesStatus::Unavailable,
            live_generation: Some(live_generation.clone()),
        };
        let (index, encoded) = build_index(&generation.catalogue().model, &keys, &state)?;
        let mut files = input.assets;
        files.insert(viewer("index.json"), encoded);
        let details = projection::pending_details(&generation.catalogue().model, &index, &keys);
        let mut schemas = UsageSchemas::new(&index.components);
        for (path, detail) in &details {
            let encoded = encode_detail(detail, &index, &mut schemas)?;
            files.insert(viewer(&format!("entries/{path}.json")), encoded);
        }
        let render_token = self.render_token.clone();
        let descriptor = LiveDescriptorV3 {
            schema_version: 3,
            generation: live_generation,
            render: RenderCapability {
                url: format!("/{}", viewer("components/render")),
                token: render_token.clone(),
            },
        };
        files.insert(viewer("live.json"), encode(&descriptor)?);
        let mut plans: Vec<_> = generation.plans().values().collect();
        plans.sort_by_key(|plan| (plan.entry, plan.viewport, plan.color_scheme));
        let routes = plans
            .into_iter()
            .map(|plan| RenderRoute {
                route: plan.route.clone(),
                path: generation.catalogue().model.entries[plan.entry]
                    .metadata
                    .path
                    .clone(),
                viewport: plan.viewport,
                color_scheme: plan.color_scheme,
            })
            .collect();
        Ok(Arc::new(Snapshot {
            details,
            routes,
            completed: BTreeMap::new(),
            documents: input.documents,
            lease: Arc::new(RevisionLease::default()),
            entries: generation
                .catalogue()
                .model
                .entries
                .iter()
                .map(|entry| entry.metadata.path.clone())
                .collect(),
            stub: stub::html(&index.identity.title),
            index,
            files,
            render_token,
        }))
    }
}

pub(crate) fn encode(value: &impl serde::Serialize) -> Result<File> {
    match canonical::to_string(value) {
        Ok(text) => Ok(File {
            bytes: text.into_bytes(),
            content_type: "application/json; charset=utf-8".into(),
        }),
        Err(source) => Err(InternalError::Model { source }.into()),
    }
}

#[tracing::instrument(name = "index.build", skip_all, err)]
fn build_index(
    model: &CatalogueModel,
    keys: &[ViewKey],
    state: &Publication,
) -> Result<(CatalogueReadModel, File)> {
    let index = match projection::index(model, keys, state) {
        Ok(index) => index,
        Err(source) => return Err(InternalError::Model { source }.into()),
    };
    let file = checked_index(&index)?;
    Ok((index, file))
}

#[tracing::instrument(name = "index.build", skip_all, err)]
pub(crate) fn revision_index(index: &CatalogueReadModel) -> Result<File> {
    checked_index(index)
}

fn checked_index(index: &CatalogueReadModel) -> Result<File> {
    let encoded = encode(index)?;
    if let Err(source) = readers::index(&String::from_utf8_lossy(&encoded.bytes)) {
        return Err(InternalError::Read { source }.into());
    }
    Ok(encoded)
}

#[tracing::instrument(name = "detail.build", skip_all, err)]
pub(crate) fn encode_detail(
    detail: &EntryDetailV1,
    index: &CatalogueReadModel,
    schemas: &mut UsageSchemas<'_>,
) -> Result<File> {
    if let Err(source) = mokly_model::detail_context::validate_with(detail, index, schemas) {
        return Err(InternalError::Read { source }.into());
    }
    encode(detail)
}
