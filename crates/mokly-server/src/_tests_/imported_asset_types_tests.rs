//! Live, authored, and comparison resources use the declared asset types.

use mokly_model::namespace::{GENERATED_DIRECTORY, generated};
use mokly_model::review_affected::ReviewSide;
use mokly_model::routes::{comparison_generation, comparison_snapshot};

use crate::assets::content_type;

#[test]
fn serve_uses_declared_types_on_each_asset_path() {
    for (file, expected) in [
        ("file.cur", "image/x-icon"),
        ("file.ico", "image/vnd.microsoft.icon"),
        ("file.pjp", "image/jpeg"),
        ("file.aac", "audio/aac"),
        ("file.vtt", "text/vtt"),
        ("file.webmanifest", "application/manifest+json"),
    ] {
        let asset = format!("assets/{file}");
        let snapshot =
            comparison_snapshot(ReviewSide::After, &format!("{GENERATED_DIRECTORY}/{asset}"));
        for path in [
            generated(&asset),
            asset,
            format!("static/authored/{file}"),
            format!("{}{snapshot}", comparison_generation("1")),
        ] {
            assert_eq!(content_type(&path), expected, "{path}");
        }
    }
}
