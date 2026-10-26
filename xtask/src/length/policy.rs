//! The length policy that the changed-file audit and the protocol cap ratchet
//! share: physical line counts and the limit of each scoped file.

use super::caps::ProtocolCaps;

/// The line limit of a TypeScript or JavaScript file.
pub(crate) const SOURCE_LIMIT: u64 = 300;
/// The line limit of a protocol page without a reviewed cap.
pub(crate) const PROTOCOL_LIMIT: u64 = 250;
/// The directory of the protocol pages.
pub(crate) const PROTOCOL_PREFIX: &str = "docs/protocol/";

/// The LF-delimited physical lines after CRLF normalization. A final LF adds
/// no empty line, so an empty file has none.
pub(crate) fn count_physical_lines(source: &[u8]) -> u64 {
    let Some(last) = source.last() else {
        return 0;
    };
    let separators = source.iter().filter(|byte| **byte == b'\n').count() as u64;
    separators + u64::from(*last != b'\n')
}

/// The limit of a scoped file: the reviewed cap or 250 lines for a protocol
/// page, and 300 lines for any other file.
pub(crate) fn allowed_lines(file: &str, caps: &ProtocolCaps) -> u64 {
    match file.strip_prefix(PROTOCOL_PREFIX) {
        Some(name) if file.ends_with(".md") => caps.get(name).unwrap_or(PROTOCOL_LIMIT),
        _ => SOURCE_LIMIT,
    }
}

/// The finding of a file above its limit.
pub(crate) fn length_finding(file: &str, source: &[u8], caps: &ProtocolCaps) -> Option<String> {
    let lines = count_physical_lines(source);
    let limit = allowed_lines(file, caps);
    (lines > limit).then(|| format!("{file}: {lines} lines (limit {limit})"))
}

/// Whether the changed-file audit covers a repository path: a TypeScript or
/// JavaScript file anywhere, or a Markdown page below `docs/protocol`.
pub(crate) fn is_audited_path(file: &str) -> bool {
    const CODE: [&str; 8] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
    CODE.iter().any(|extension| file.ends_with(extension))
        || (file.starts_with(PROTOCOL_PREFIX) && file.ends_with(".md") && !file.contains('\n'))
}

#[cfg(test)]
#[path = "_tests_/policy_tests.rs"]
mod policy_tests;
