//! Imported media types do not broaden CSS url() extension validation.

use mokly_model::content_types::imported_content_type;

use super::stylesheet_content_type;

#[test]
fn imported_asset_content_types_cover_media_without_changing_stylesheet_assets() {
    for (extension, expected) in [
        ("apng", "image/apng"),
        ("cur", "image/x-icon"),
        ("jfif", "image/jpeg"),
        ("pjp", "image/jpeg"),
        ("pjpeg", "image/jpeg"),
        ("jxl", "image/jxl"),
        ("aac", "audio/aac"),
        ("flac", "audio/flac"),
        ("m4a", "audio/mp4"),
        ("mov", "video/quicktime"),
        ("mp3", "audio/mpeg"),
        ("mp4", "video/mp4"),
        ("ogg", "audio/ogg"),
        ("opus", "audio/ogg"),
        ("wav", "audio/wav"),
        ("webm", "video/webm"),
        ("pdf", "application/pdf"),
        ("vtt", "text/vtt"),
        ("webmanifest", "application/manifest+json"),
        ("txt", "text/plain; charset=utf-8"),
    ] {
        let file = format!("assets/file.{extension}");
        assert_eq!(imported_content_type(&file), Some(expected), "{file}");
        assert_eq!(stylesheet_content_type(&file), None, "{file}");
    }
    assert_eq!(imported_content_type("assets/file.png"), Some("image/png"));
    assert_eq!(
        imported_content_type("assets/file.svg"),
        Some("image/svg+xml")
    );
    assert_eq!(stylesheet_content_type("png"), Some("image/png"));
    for file in [
        "image.PNG",
        "image.png.extra",
        "file.TXT",
        "image",
        "image.unknown",
    ] {
        assert_eq!(imported_content_type(file), None, "{file}");
    }
}
