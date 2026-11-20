//! Deferred anchor contract types.

use mkc_domain::entry_path::EntryPath;
use mkc_mokly_contract::index_values::ColorScheme;
use mkc_mokly_contract::index_values::Viewport;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Anchor {
    pub(crate) publication_id: Uuid,
    /// Entry path. Deferred comment handlers must also refuse device names and a first
    /// segment of mokly-generated.
    pub(crate) screen_path: EntryPath,
    #[schema(inline)]
    pub(crate) viewport: Viewport,
    #[schema(inline)]
    pub(crate) color_scheme: ColorScheme,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false, min_length = 1, max_length = 1024)]
    pub(crate) element_path: Option<String>,
}
