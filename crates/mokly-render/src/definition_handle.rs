//! Split definition handles without truncating their module paths.

/// Separate a module path and export at the final hash.
/// A handle without a separator retains its module path and has an empty export.
pub(crate) fn split(handle: &str) -> (&str, &str) {
    handle.rsplit_once('#').unwrap_or((handle, ""))
}
