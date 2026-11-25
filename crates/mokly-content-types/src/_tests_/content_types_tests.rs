//! File extensions select the same delivered types on all public paths.

use super::{
    FILE_LOADER_ONLY_TYPES, IMPORT_ONLY_TYPES, STYLESHEET_TYPES, delivered_content_type,
    stylesheet_content_type,
};

fn live_and_snapshot_paths(asset: &str) -> [String; 2] {
    [
        format!("static/mokly-generated/{asset}"),
        format!("mokly-viewer/diffs/generations/1/snapshots/after/mokly-generated/{asset}"),
    ]
}

#[test]
fn stylesheet_types_use_extensions_of_file_names() {
    for (path, expected) in [
        ("png", None),
        ("a.PNG", None),
        ("dir.png/file", None),
        ("dir/a.png", Some("image/png")),
    ] {
        assert_eq!(stylesheet_content_type(path), expected, "{path}");
    }
}

#[test]
fn delivered_types_match_literal_values_on_each_asset_path() {
    for (file, expected) in [
        ("file.cur", "image/x-icon"),
        ("file.ico", "image/vnd.microsoft.icon"),
        ("file.pjp", "image/jpeg"),
        ("file.aac", "audio/aac"),
        ("file.vtt", "text/vtt"),
        ("file.webmanifest", "application/manifest+json"),
    ] {
        let asset = format!("assets/{file}");
        let [live, snapshot] = live_and_snapshot_paths(&asset);
        for path in [live, asset, format!("static/authored/{file}"), snapshot] {
            assert_eq!(delivered_content_type(&path), expected, "{path}");
        }
    }
}

#[test]
fn delivered_types_follow_file_extensions_on_each_public_path() {
    for (extension, expected) in STYLESHEET_TYPES
        .iter()
        .chain(IMPORT_ONLY_TYPES)
        .chain(FILE_LOADER_ONLY_TYPES)
    {
        let asset = format!("assets/file{extension}");
        let [live, snapshot] = live_and_snapshot_paths(&asset);
        for path in [live, format!("static/file{extension}"), snapshot] {
            assert_eq!(delivered_content_type(&path), *expected, "{path}");
        }
    }
    for (path, expected) in [
        ("dir.png/file", "application/octet-stream"),
        ("static/file.PJP", "application/octet-stream"),
        ("index.html", "text/html; charset=utf-8"),
        ("index.json", "application/json; charset=utf-8"),
    ] {
        assert_eq!(delivered_content_type(path), expected, "{path}");
    }
}
