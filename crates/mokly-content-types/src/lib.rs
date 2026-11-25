//! Content types for delivered files and imported assets.

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

const FILE_LOADER_ONLY_TYPES: &[(&str, &str)] = &[(".txt", "text/plain; charset=utf-8")];

/// Look up the declared type of an imported asset by its case-sensitive file extension.
pub fn imported_content_type(path: &str) -> Option<&'static str> {
    let extension = file_extension(path)?;
    find_content_type(STYLESHEET_TYPES, extension)
        .or_else(|| find_content_type(IMPORT_ONLY_TYPES, extension))
        .or_else(|| find_content_type(FILE_LOADER_ONLY_TYPES, extension))
}

/// Look up the type of a CSS `url()` target by its case-sensitive file extension.
pub fn stylesheet_content_type(path: &str) -> Option<&'static str> {
    find_content_type(STYLESHEET_TYPES, file_extension(path)?)
}

/// Format the supported CSS asset extensions for an unsupported-extension diagnostic.
pub fn stylesheet_extensions() -> String {
    let Some(((last, _), preceding)) = STYLESHEET_TYPES.split_last() else {
        return String::new();
    };
    let extensions: Vec<_> = preceding.iter().map(|(extension, _)| *extension).collect();
    format!("{} or {last}", extensions.join(", "))
}

/// Use the declared asset type, or guess a type and add UTF-8 for text and JSON.
pub fn delivered_content_type(path: &str) -> String {
    if let Some(mime) = imported_content_type(path) {
        return mime.into();
    }
    let mime = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    if mime.starts_with("text/") || mime == "application/json" {
        format!("{mime}; charset=utf-8")
    } else {
        mime
    }
}

fn file_extension(path: &str) -> Option<&str> {
    path.rsplit('/')
        .next()?
        .rsplit_once('.')
        .map(|(_, extension)| extension)
}

fn find_content_type(types: &[(&str, &'static str)], extension: &str) -> Option<&'static str> {
    types
        .iter()
        .find_map(|(known, mime)| (known.strip_prefix('.') == Some(extension)).then_some(*mime))
}

#[cfg(test)]
#[path = "_tests_/content_types_tests.rs"]
mod content_types_tests;

#[cfg(test)]
#[path = "_tests_/imported_content_types_tests.rs"]
mod imported_content_types_tests;
