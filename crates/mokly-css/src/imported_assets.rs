//! Content types for stylesheet assets and additional JavaScript imports.

const STYLESHEET_TYPES: &[(&str, &str)] = &[
    (".avif", "image/avif"),
    (".bmp", "image/bmp"),
    (".gif", "image/gif"),
    (".ico", "image/vnd.microsoft.icon"),
    (".jpeg", "image/jpeg"),
    (".jpg", "image/jpeg"),
    (".png", "image/png"),
    (".svg", "image/svg+xml"),
    (".webp", "image/webp"),
    (".eot", "application/vnd.ms-fontobject"),
    (".otf", "font/otf"),
    (".ttf", "font/ttf"),
    (".woff", "font/woff"),
    (".woff2", "font/woff2"),
];

const IMPORT_ONLY_TYPES: &[(&str, &str)] = &[
    (".apng", "image/apng"),
    (".cur", "image/x-icon"),
    (".jfif", "image/jpeg"),
    (".pjp", "image/jpeg"),
    (".pjpeg", "image/jpeg"),
    (".jxl", "image/jxl"),
    (".aac", "audio/aac"),
    (".flac", "audio/flac"),
    (".m4a", "audio/mp4"),
    (".mov", "video/quicktime"),
    (".mp3", "audio/mpeg"),
    (".mp4", "video/mp4"),
    (".ogg", "audio/ogg"),
    (".opus", "audio/ogg"),
    (".wav", "audio/wav"),
    (".webm", "video/webm"),
    (".pdf", "application/pdf"),
    (".vtt", "text/vtt"),
    (".webmanifest", "application/manifest+json"),
];

/// Content type for an imported opaque asset without decoding its contents.
pub fn content_type(path: &str) -> Option<&'static str> {
    let (_, extension) = path.rsplit_once('.')?;
    find_content_type(STYLESHEET_TYPES, extension)
        .or_else(|| find_content_type(IMPORT_ONLY_TYPES, extension))
}

/// Content type of a CSS `url()` target, with the existing bare-name fallback.
pub(crate) fn stylesheet_content_type(path: &str) -> Option<&'static str> {
    find_content_type(STYLESHEET_TYPES, path.rsplit('.').next()?)
}

/// List the supported CSS extensions for the unsupported-extension diagnostic.
pub(crate) fn stylesheet_extensions() -> String {
    let Some(((last, _), preceding)) = STYLESHEET_TYPES.split_last() else {
        return String::new();
    };
    let extensions: Vec<_> = preceding.iter().map(|(extension, _)| *extension).collect();
    format!("{} or {last}", extensions.join(", "))
}

fn find_content_type(types: &[(&str, &'static str)], extension: &str) -> Option<&'static str> {
    types
        .iter()
        .find_map(|(known, mime)| (known.strip_prefix('.') == Some(extension)).then_some(*mime))
}

#[cfg(test)]
#[path = "_tests_/imported_assets_tests.rs"]
mod imported_assets_tests;
