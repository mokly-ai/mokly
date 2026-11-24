//! Generated resources use explicit asset types on live and comparison routes.

use crate::assets::{content_type, generated_content_type};

#[test]
fn generated_asset_routes_use_the_imported_type_table() {
    for (file, expected) in [
        ("file.cur", "image/x-icon"),
        ("file.ico", "image/vnd.microsoft.icon"),
        ("file.aac", "audio/aac"),
        ("file.vtt", "text/vtt"),
        ("file.webmanifest", "application/manifest+json"),
    ] {
        assert_eq!(
            generated_content_type(&format!("assets/{file}")),
            expected,
            "{file}"
        );
        assert_eq!(
            content_type(&format!("static/mokly-generated/assets/{file}")),
            expected,
            "{file}"
        );
    }
    assert_eq!(
        content_type("static/authored/file.vtt"),
        "text/vtt; charset=utf-8"
    );
}
