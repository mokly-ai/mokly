//! Platform-independent path identity grammar.

use crate::namespace;
/// Whether a segment names a Windows device, without regard to case.
pub fn is_windows_device_name(value: &str) -> bool {
    let value = value.to_ascii_lowercase();
    matches!(value.as_str(), "aux" | "con" | "nul" | "prn")
        || ["com", "lpt"].iter().any(|prefix| {
            value.strip_prefix(prefix).is_some_and(|suffix| {
                suffix.len() == 1 && matches!(suffix.as_bytes()[0], b'1'..=b'9')
            })
        })
}

/// Check one ASCII, URL-safe path segment, preserving its spelling.
pub fn is_path_segment(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
        && !is_windows_device_name(value)
}

/// Check a complete entry path, including the reserved first route segment.
pub fn is_entry_path(value: &str) -> bool {
    value.split('/').all(is_path_segment)
        && !value
            .split('/')
            .next()
            .is_some_and(|first| first.eq_ignore_ascii_case(namespace::GENERATED_DIRECTORY))
}

/// Consistent title fallback for valid slugs.
pub fn title_from_slug(slug: &str) -> String {
    let spaced = slug.replace(['-', '_'], " ");
    if spaced.trim().is_empty() {
        return slug.to_owned();
    }
    let mut chars = spaced.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => slug.into(),
    }
}
