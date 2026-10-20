//! Atomic public snapshot bytes and declared shell routes.

use std::collections::BTreeMap;
use std::ops::Deref;
use std::sync::Arc;

use mokly_compare::projection_index;
use mokly_graph::types::RenderGeneration;
use mokly_model::canonical;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::namespace::viewer;
use mokly_model::projection::{self, Publication, ViewKey};
use mokly_model::public_detail::EntryDetailV2;
use mokly_model::public_detail::{LiveDescriptorV3, RenderCapability};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::readers;
use mokly_model::shell;

use crate::assets::File;
use crate::backend::Documents;
use crate::changes::Accepted;
use crate::detail_encoding::ValidatedDetails;
use crate::error::{InternalError, Result};
use crate::evidence::{Completion, RenderRoute};
use crate::generation::Generation;
use crate::replacement;
use crate::revision::{RenderLease, RevisionLease};
use crate::revision_file::RevisionFile;

/// One immutable publication; replacement swaps this whole value.
#[derive(Clone)]
pub struct Snapshot {
    /// Accepted classification, replaced atomically with its public records.
    pub changes: Option<Arc<Accepted>>,
    /// Document keys used to retain proven usage across render generations.
    pub document_keys: BTreeMap<String, String>,
    /// Shared routes, assets, and backend for this generation.
    pub generation: Arc<Generation>,
    /// Validated payloads; their wire revision is supplied by this snapshot.
    pub details: BTreeMap<String, Arc<EntryDetailV2>>,
    /// Completed visual usage; a recorded route is never published twice.
    pub completed: BTreeMap<String, Completion>,
    /// Validity of live work admitted under this revision.
    pub lease: Arc<dyn RenderLease>,
    /// Parsed index for render and detail context.
    pub index: CatalogueReadModel,
    /// Shared canonical JSON payloads with a revision supplied at delivery.
    pub files: BTreeMap<String, RevisionFile>,
}

impl Deref for Snapshot {
    type Target = Generation;
    fn deref(&self) -> &Generation {
        &self.generation
    }
}

impl Snapshot {
    /// Stamp an already validated candidate without projecting its generation again.
    pub fn at_revision(&self, revision: u64) -> Arc<Self> {
        let mut next = self.clone();
        next.index.revision = revision;
        next.lease = Arc::new(RevisionLease::default());
        Arc::new(next)
    }

    /// Materialize one detail with this publication's revision for typed consumers.
    pub fn detail(&self, path: &str) -> Option<EntryDetailV2> {
        self.details.get(path).map(|detail| {
            let mut detail = detail.as_ref().clone();
            detail.revision = Some(self.index.revision);
            detail
        })
    }
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
    /// Replace a render generation while retaining equal encoded detail payloads.
    fn replace(
        &self,
        generation: Arc<dyn RenderGeneration>,
        input: SnapshotInput,
        _previous: &Snapshot,
    ) -> Result<Arc<Snapshot>> {
        self.create(generation, input)
    }
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
        self.project(generation, input, None)
    }
    fn replace(
        &self,
        generation: Arc<dyn RenderGeneration>,
        input: SnapshotInput,
        previous: &Snapshot,
    ) -> Result<Arc<Snapshot>> {
        self.project(generation, input, Some(previous))
    }
}

impl Projector {
    fn project(
        &self,
        generation: Arc<dyn RenderGeneration>,
        input: SnapshotInput,
        previous: Option<&Snapshot>,
    ) -> Result<Arc<Snapshot>> {
        let keys = projection_index::keys(generation.as_ref());
        let live_generation = generation.generation_key().to_owned();
        let state = Publication {
            config_path: input.config_path,
            deployment_id: self.deployment_id.clone(),
            revision: input.revision,
            base: input.base,
            changes_status: ChangesStatus::Pending,
            live_generation: Some(live_generation.clone()),
        };
        let (index, encoded) = build_index(&generation.catalogue().model, &keys, &state)?;
        let mut assets = input.assets;
        let mut files = BTreeMap::from([(viewer("index.json"), RevisionFile::new(encoded)?)]);
        let document_keys = generation
            .plans()
            .iter()
            .map(|(route, plan)| (route.clone(), plan.key.0.clone()))
            .collect();
        let mut details = projection::pending_details(&generation.catalogue().model, &index, &keys);
        let completed = replacement::reuse_usage(&mut details, &index, &document_keys, previous);
        let details =
            replacement::encode_details(details, &index, previous, &mut files, &ValidatedDetails)?;
        let render_token = self.render_token.clone();
        let descriptor = LiveDescriptorV3 {
            schema_version: 3,
            generation: live_generation,
            render: RenderCapability {
                url: format!("/{}", viewer("components/render")),
                token: render_token.clone(),
            },
        };
        assets.insert(viewer("live.json"), encode(&descriptor)?);
        let mut plans: Vec<_> = generation.plans().values().collect();
        plans.sort_by_key(|plan| (plan.entry, plan.viewport, plan.color_scheme));
        let routes: Vec<RenderRoute> = plans
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
        let views = routes
            .iter()
            .filter(|route| route.viewport.is_some())
            .map(|route| (route.route.clone(), route.clone()))
            .collect();
        let shared = Arc::new(Generation {
            model: Arc::new(generation.catalogue().model.clone()),
            view_keys: keys,
            config_path: state.config_path,
            changes: None,
            routes,
            views,
            assets,
            documents: input.documents,
            entries: generation
                .catalogue()
                .model
                .entries
                .iter()
                .map(|entry| entry.metadata.path.clone())
                .collect(),
            stub: shell::html(&index.identity.title).into(),
            render_token,
        });
        Ok(Arc::new(Snapshot {
            changes: None,
            generation: shared,
            document_keys,
            details,
            completed,
            lease: Arc::new(RevisionLease::default()),
            index,
            files,
        }))
    }
}

pub(crate) fn encode(value: &impl serde::Serialize) -> Result<File> {
    match canonical::to_string(value) {
        Ok(text) => Ok(File {
            bytes: text.into_bytes().into(),
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

pub(crate) fn checked_index(index: &CatalogueReadModel) -> Result<File> {
    let encoded = encode(index)?;
    if let Err(source) = readers::index(&String::from_utf8_lossy(&encoded.bytes)) {
        return Err(InternalError::Read { source }.into());
    }
    Ok(encoded)
}
