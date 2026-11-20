//! JavaScript asset content types, independent of the narrower CSS url() list.

/// Case-sensitive JavaScript asset extensions and their delivered content types.
pub const TYPES: &[(&str, &str)] = &[
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
    let extension = path.rfind('.').map(|index| &path[index..])?;
    TYPES
        .iter()
        .find_map(|(known, mime)| (*known == extension).then_some(*mime))
}

#[cfg(test)]
#[path = "_tests_/imported_assets_tests.rs"]
mod imported_assets_tests;
