//! Catalogue index v7, its navigation tree, and historical records.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::public_metadata::{CatalogueIdentity, ChangesStatus};
use crate::public_records::{
    CatalogueComponent, CatalogueDocument, CataloguePage, CatalogueRecord, CatalogueScreen,
    CatalogueUseCase,
};

/// Public tree nodes. Entry children hold variants and index-folder members.
#[derive(Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum CatalogueNode {
    /// A folder with no screen or component own page.
    Folder {
        /// Complete folder path.
        path: String,
        /// Resolved folder title.
        title: String,
        /// Own document, page, or use-case path.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        index: Option<String>,
        /// Present as true exactly on hidden folders.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        hidden: Option<True>,
        /// Authored child order.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        order: Option<Vec<String>>,
        /// Nonempty current children.
        children: Vec<CatalogueNode>,
    },
    /// One entry row.
    Entry {
        /// Current entry path.
        path: String,
        /// Present as true exactly on hidden index folders.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        hidden: Option<True>,
        /// Authored folder child order, only on an index folder.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        order: Option<Vec<String>>,
        /// Variants in authored order, then index-folder members.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        children: Option<Vec<CatalogueNode>>,
    },
}
/// The literal boolean true used by optional hidden fields.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(try_from = "bool", into = "bool")]
#[ts(type = "true")]
pub struct True;

impl TryFrom<bool> for True {
    type Error = &'static str;
    fn try_from(value: bool) -> Result<Self, Self::Error> {
        if value {
            Ok(Self)
        } else {
            Err("hidden must be true or absent")
        }
    }
}
impl From<True> for bool {
    fn from(_: True) -> Self {
        true
    }
}

/// Serve render generation fence.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LiveGeneration {
    /// Hash of all live render inputs.
    pub generation: String,
}

/// Historical preview descriptor, with no current route.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum RemovedPreview {
    /// Removed screen view.
    Screen,
    /// Removed page document.
    Page,
    /// Removed Markdown document.
    Document,
}

/// One removed entry and its historical breadcrumb data.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemovedEntry {
    /// Historical public record.
    pub entry: CatalogueRecord,
    /// Base-side resolved folder titles.
    pub folder_titles: Vec<String>,
    /// Required exactly on removed variants.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_title: Option<String>,
    /// Base-scoped historical identity, when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub snapshot_id: Option<String>,
    /// Optional historical preview kind.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub preview: Option<RemovedPreview>,
}

/// Complete public catalogue index v7.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueReadModel {
    /// Must equal 7; readers gate it before decoding.
    #[ts(type = "7")]
    pub schema_version: u32,
    /// Origin-scoped catalogue identity.
    pub identity: CatalogueIdentity,
    /// Build or Serve deployment identity.
    pub deployment_id: String,
    /// Serve publication counter, or zero in a build.
    pub revision: u64,
    /// Comparison base ref when configured.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub base: Option<String>,
    /// Present only in Serve.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub live: Option<LiveGeneration>,
    /// Comparison preparation state.
    pub changes_status: ChangesStatus,
    /// Generation-pinned review URL, or null.
    pub comparison_url: Option<String>,
    /// One tree containing each current entry exactly once.
    pub tree: Vec<CatalogueNode>,
    /// Top-level authored child order.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tree_order: Option<Vec<String>>,
    /// Current screens and variants.
    pub screens: Vec<CatalogueScreen>,
    /// Current pages.
    pub pages: Vec<CataloguePage>,
    /// Current documents.
    pub documents: Vec<CatalogueDocument>,
    /// Current ordered journeys.
    pub use_cases: Vec<CatalogueUseCase>,
    /// Current component parents and variants.
    pub components: Vec<CatalogueComponent>,
    /// Historical entries in canonical order.
    pub removed_entries: Vec<RemovedEntry>,
}
