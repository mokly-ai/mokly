//! One stable lock mapping for every operation of each cache kind.

use std::path::{Path, PathBuf};

use crate::cache_types::Kind;

/// The bundles stripe count and first-byte mapping are fixed for this directory.
/// A different mapping requires a different namespace directory across releases.
pub(crate) fn entry_lock_path(namespace: &Path, kind: Kind, key: &str) -> PathBuf {
    let name = match kind {
        Kind::Sources | Kind::Dependencies => format!("{key}.lock"),
        Kind::Bundles | Kind::Renders => format!(
            "stripe-{}.lock",
            key.get(..2).unwrap_or("00").to_ascii_lowercase()
        ),
    };
    namespace.join("locks").join(name)
}
