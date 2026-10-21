//! Requested and physical locations share one ordered public-path classifier.

use std::path::{Path, PathBuf};

use mokly_model::namespace;

use crate::public_denial::PublicDenial;

pub(crate) fn denial(path: &str, absolute: &Path, private: &[PathBuf]) -> Option<PublicDenial> {
    if path.starts_with('/')
        || path.contains(['\\', ':', '\0'])
        || path.split('/').any(|part| matches!(part, "" | "." | ".."))
    {
        return Some(PublicDenial::Unsafe);
    }
    if path.split('/').any(|part| part.starts_with('.')) {
        return Some(PublicDenial::Hidden);
    }
    if path
        .split('/')
        .next()
        .is_some_and(|first| first.eq_ignore_ascii_case(namespace::GENERATED_DIRECTORY))
    {
        return Some(PublicDenial::Generated);
    }
    if path.split('/').any(|part| part == "node_modules") {
        return Some(PublicDenial::Dependency);
    }
    private
        .iter()
        .any(|private| absolute.starts_with(private))
        .then_some(PublicDenial::Private)
}
