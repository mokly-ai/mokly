//! Marked cache-file observations remain live-only and reject other evidence kinds.

use std::collections::BTreeMap;

use crate::compiled::{PhysicalInput, ReuseEvidence, UncapturedEvidence};
use crate::methods::BundleCapture;

#[test]
fn file_and_path_observations_admit_marked_reuse_without_admitting_full_reuse() {
    let mut evidence = ReuseEvidence {
        complete: false,
        durable: false,
        uncaptured: Some(UncapturedEvidence::ServeEdit),
        inputs: BTreeMap::from([
            (
                "/pkg/package.json".into(),
                PhysicalInput::File {
                    digest: "digest".into(),
                },
            ),
            ("/pkg/build.js".into(), PhysicalInput::FilePath),
            ("/pkg/missing.ts".into(), PhysicalInput::Absent),
            (
                "/pkg/link".into(),
                PhysicalInput::Link {
                    target: "/pkg/target".into(),
                },
            ),
        ]),
    };
    assert!(evidence.serve_edit());
    assert!(evidence.reusable(BundleCapture::ServeEdit));
    assert!(!evidence.reusable(BundleCapture::Full));
    evidence.inputs.insert(
        "/pkg/directory".into(),
        PhysicalInput::Directory { entries: vec![] },
    );
    assert!(!evidence.serve_edit());
}
