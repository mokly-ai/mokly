//! Git can retain raw bytes after an optional filter emits a failure diagnostic.

pub(crate) fn filter_failed(stderr: &[u8]) -> bool {
    let stderr = String::from_utf8_lossy(stderr).to_ascii_lowercase();
    stderr.contains("external filter") && stderr.contains("failed")
}
