//! File extensions select the same delivered types on all public paths.

use crate::namespace::{GENERATED_DIRECTORY, generated};
use crate::review_affected::ReviewSide;
use crate::routes::{comparison_generation, comparison_snapshot};

use super::{FILE_LOADER_ONLY_TYPES, IMPORT_ONLY_TYPES, STYLESHEET_TYPES, delivered_content_type};

#[test]
fn delivered_types_follow_file_extensions_on_each_public_path() {
    for (extension, expected) in STYLESHEET_TYPES
        .iter()
        .chain(IMPORT_ONLY_TYPES)
        .chain(FILE_LOADER_ONLY_TYPES)
    {
        let asset = format!("assets/file{extension}");
        let snapshot =
            comparison_snapshot(ReviewSide::After, &format!("{GENERATED_DIRECTORY}/{asset}"));
        for path in [
            generated(&asset),
            format!("static/file{extension}"),
            format!("{}{snapshot}", comparison_generation("1")),
        ] {
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
