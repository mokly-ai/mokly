//! Independent protocol version numbers; package versions are separate.

/// Public catalogue index version.
pub const CATALOGUE_INDEX: u32 = 8;
/// Static deployment file version.
pub const DEPLOYMENT_FILE: u32 = 1;
/// Per-entry detail version.
pub const ENTRY_DETAIL: u32 = 3;
/// In-memory material and resource review version; never written.
pub const REVIEW_RESULT: u32 = 8;
/// Catalogue change snapshot version.
pub const CHANGE_SNAPSHOT: u32 = 4;
/// Live render capability descriptor version.
pub const LIVE_DESCRIPTOR: u32 = 3;
/// Inspector message envelope version.
pub const INSPECTOR_WIRE: u32 = 2;
/// Removed page and document metadata version.
pub const REMOVED_PREVIEW: u32 = 3;
/// Static output ownership version.
pub const EXPORT_OWNERSHIP: u32 = 3;
/// Upload metadata version.
pub const UPLOAD_METADATA: u32 = 3;
/// Upload plan exchange version.
pub const PLAN_EXCHANGE: u32 = 1;
/// Navigation disclosure storage key.
pub const NAVIGATION_DISCLOSURE: &str = "mokly:nav-disclosure:v4";
/// Static output transaction marker version.
pub const EXPORT_TRANSACTION: u32 = 2;
/// Verification process owner record version.
pub const PROCESS_OWNER: u32 = 1;
/// Browser module inventory version.
pub const BROWSER_MODULE_INVENTORY: u32 = 1;
/// Diagnostic timing record version.
pub const TIMING_RECORD: u32 = 1;
/// Verification report version.
pub const VERIFICATION_REPORT: u32 = 1;
