//! Publication construction keeps the render backend and public JSON together.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_cli::serve::PreparedServe;
use mokly_graph::policy::FilePolicy;
use mokly_server::assets::File;
use mokly_server::backend::GraphDocuments;
use mokly_server::error::{Result, ServerError};
use mokly_server::public_read::ConfinedReader;
use mokly_server::snapshot::{Snapshot, SnapshotFactory, SnapshotInput};
use mokly_source_interface::tree::SourceTree;

use crate::serve_changes::ChangeSources;
use crate::serve_warnings::AttemptWarnings;

#[cfg_attr(test, unimock::unimock(api = ServeStateFactoryMock))]
pub(super) trait ServeStateFactory: Send + Sync {
    fn create(
        &self,
        prepared: &PreparedServe,
        revision: u64,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Result<Arc<Snapshot>>;
    fn replace(
        &self,
        prepared: &PreparedServe,
        revision: u64,
        _previous: &Snapshot,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Result<Arc<Snapshot>> {
        self.create(prepared, revision, warnings)
    }
}

pub(super) struct NativeServeState {
    pub(super) changes: Arc<dyn ChangeSources>,
    pub(super) tree: Arc<dyn SourceTree>,
    pub(super) projector: Arc<dyn SnapshotFactory>,
    pub(super) assets: BTreeMap<String, File>,
    pub(super) base: Option<String>,
}

impl ServeStateFactory for NativeServeState {
    fn create(
        &self,
        prepared: &PreparedServe,
        revision: u64,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Result<Arc<Snapshot>> {
        self.project(prepared, revision, None, warnings)
    }
    fn replace(
        &self,
        prepared: &PreparedServe,
        revision: u64,
        previous: &Snapshot,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Result<Arc<Snapshot>> {
        self.project(prepared, revision, Some(previous), warnings)
    }
}
impl NativeServeState {
    fn project(
        &self,
        prepared: &PreparedServe,
        revision: u64,
        previous: Option<&Snapshot>,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Result<Arc<Snapshot>> {
        let config = &prepared.config;
        let policy = match FilePolicy::new(
            self.tree.clone(),
            config,
            &prepared.generation.catalogue().model.sources,
            Default::default(),
            Some(&config.repo_root.join("mokly-static")),
        ) {
            Ok(policy) => policy,
            Err(source) => return Err(ServerError::Render { source }),
        };
        let documents = Arc::new(GraphDocuments::new(
            prepared.generation.clone(),
            Arc::new(ConfinedReader {
                repo_root: config.repo_root.clone(),
                policy: Arc::new(policy),
            }),
            warnings.clone(),
        ));
        let base = self
            .base
            .clone()
            .or_else(|| {
                config
                    .input
                    .review
                    .as_ref()
                    .and_then(|review| review.base.clone())
            })
            .unwrap_or_else(|| "origin/main".into());
        let input = SnapshotInput {
            documents,
            revision,
            config_path: relative(&config.file, &config.repo_root),
            base: Some(base),
            assets: self.assets.clone(),
        };
        let snapshot = match previous {
            Some(previous) => self
                .projector
                .replace(prepared.generation.clone(), input, previous),
            None => self.projector.create(prepared.generation.clone(), input),
        }?;
        let mut snapshot = (*snapshot).clone();
        let mut generation = (*snapshot.generation).clone();
        generation.changes = Some(self.changes.create(prepared, warnings));
        snapshot.generation = Arc::new(generation);
        Ok(Arc::new(snapshot))
    }
}
