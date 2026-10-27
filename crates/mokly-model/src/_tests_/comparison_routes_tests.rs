//! Shared producers retain byte-identical comparison and preview paths.

use crate::review_affected::ReviewSide;
use crate::routes;

#[test]
fn comparison_routes_keep_each_side_and_unicode_path_without_host_specific_encoding() {
    assert_eq!(
        routes::comparison_snapshot(
            ReviewSide::Before,
            "mokly-generated/café/index.desktop.html"
        ),
        "snapshots/before/mokly-generated/café/index.desktop.html"
    );
    assert_eq!(
        routes::comparison_snapshot(ReviewSide::After, "assets/logo.svg"),
        "snapshots/after/assets/logo.svg"
    );
    assert_eq!(
        routes::comparison_preview("old/page"),
        "previews/old/page/index.json"
    );
    assert_eq!(
        routes::comparison_generation("hash"),
        "mokly-viewer/diffs/generations/hash/"
    );
}
