//! Regression plans for declared catalogue files.

use serde_json::json;

use crate::error::{Error, Limit};
use crate::limits::{Limits, Quotas};

use super::bundle_tests::{entry, plan, validate, validate_with_limits};

#[test]
fn case_renamed_folders_keep_shells_for_removed_siblings() {
    let files = plan(&[
        entry("view/Account/removed/index.html", b"previous"),
        entry("view/account/kept/index.html", b"current"),
    ]);
    assert!(validate(files).is_ok());
}

#[test]
fn declared_bytes_and_decompressed_plan_bytes_have_separate_quotas() {
    let files = plan(&[json!({
        "path": "static/movie.bin", "sha256": "a".repeat(64), "size": 1_048_576
    })]);
    let plan_limit = Limits::lowered(Quotas {
        decompressed: 4_096,
        ..Quotas::default()
    });
    let result = validate_with_limits(files.clone(), plan_limit);
    assert!(
        matches!(&result, Ok(bundle) if bundle.inventory().entry("static/movie.bin").map(|file| file.size) == Some(1_048_576)),
        "{result:?}"
    );
    let declared_limit = Limits::lowered(Quotas {
        declared: 1_048_576,
        ..Quotas::default()
    });
    assert!(matches!(
        validate_with_limits(files, declared_limit),
        Err(Error::TooLarge {
            limit: Limit::DeclaredBytes
        })
    ));
}
