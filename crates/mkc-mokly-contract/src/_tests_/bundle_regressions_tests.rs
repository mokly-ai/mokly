//! Regression plans retain the producer's side paths and directory spellings.

use super::bundle_tests::{entry, plan, validate};

#[test]
fn case_renamed_folders_keep_shells_for_removed_siblings() {
    let files = plan(&[
        entry("view/Account/removed/index.html", b"previous"),
        entry("view/account/kept/index.html", b"current"),
    ]);
    assert!(validate(files).is_ok());
}
