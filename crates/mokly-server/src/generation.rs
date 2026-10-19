//! Data shared by every evidence revision of one immutable render generation.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use axum::body::Bytes;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::projection::ViewKey;

use crate::assets::File;
use crate::backend::Documents;
use crate::changes::ChangeSource;
use crate::evidence::RenderRoute;

/// Routes, assets, and render services never change during evidence publication.
#[derive(Clone)]
pub struct Generation {
    /// Immutable inputs for the shared model projection on every status transition.
    pub model: Arc<CatalogueModel>,
    /// Declared document identities for that model.
    pub view_keys: Vec<ViewKey>,
    /// Configuration identity used by current and historical projections.
    pub config_path: String,
    /// Optional command-owned classifier for this exact head generation.
    pub changes: Option<Arc<dyn ChangeSource>>,
    /// Matching immutable render and public-file backend.
    pub documents: Arc<dyn Documents>,
    /// Work in catalogue and view order.
    pub routes: Vec<RenderRoute>,
    /// Routes that can contribute detail usage, indexed without a per-request scan.
    pub views: BTreeMap<String, RenderRoute>,
    /// Loaded package assets and the live descriptor.
    pub assets: BTreeMap<String, File>,
    /// Validated entry identities for shell routes.
    pub entries: BTreeSet<String>,
    /// Identical data-free shell bytes.
    pub stub: Bytes,
    /// Per-process secret capability.
    pub render_token: String,
}
