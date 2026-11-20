//! Decode only the index fields that the receiver uses; ignore all other fields.

use serde::Deserialize;

use crate::index_records::ViewAxes;
use crate::index_values::{ChangeKind, ChangesStatus};
use crate::json;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Document {
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) base: Option<String>,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) base_commit: Option<String>,
    pub(crate) changes_status: ChangesStatus,
    #[serde(deserialize_with = "json::nullable")]
    pub(crate) comparison_url: Option<String>,
    pub(crate) components: Vec<CurrentRecord>,
    pub(crate) documents: Vec<CurrentRecord>,
    pub(crate) pages: Vec<CurrentRecord>,
    pub(crate) screens: Vec<ScreenRecord>,
    pub(crate) use_cases: Vec<CurrentRecord>,
    pub(crate) removed_entries: Vec<RemovedRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurrentRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) previous_path: Option<String>,
    #[serde(deserialize_with = "json::object")]
    pub(crate) changes: Changes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScreenRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) previous_path: Option<String>,
    #[serde(deserialize_with = "json::object")]
    pub(crate) changes: Changes,
    pub(crate) views: Vec<ViewAxes>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RemovedRecord {
    pub(crate) entry: HistoricalRecord,
}

#[derive(Debug, Deserialize)]
pub(crate) struct HistoricalRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(deserialize_with = "json::object")]
    pub(crate) changes: Changes,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub(crate) enum Changes {
    Preparing {},
    Pending {},
    Unavailable {},
    Disabled {},
    Ready {
        #[serde(deserialize_with = "json::string_enum")]
        kind: ChangeKind,
        included: bool,
    },
}

impl Changes {
    pub(crate) fn counted_kind(self) -> Option<ChangeKind> {
        match self {
            Self::Ready {
                kind,
                included: true,
            } => Some(kind),
            _ => None,
        }
    }
}
