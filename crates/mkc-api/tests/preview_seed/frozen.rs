//! A fixed released catalogue adapted through the shared upload fixture builder.

use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

use serde::Deserialize;

pub(super) const HEAD: &str = "1111111111111111111111111111111111111111";

#[derive(Deserialize)]
pub(super) struct Catalogue {
    pub(super) plan: Vec<u8>,
    pub(super) blobs: BTreeMap<String, Vec<u8>>,
}

pub(super) fn catalogue(pull_request: Option<u32>) -> &'static Catalogue {
    static PREVIEW: OnceLock<Catalogue> = OnceLock::new();
    static LOCAL: OnceLock<Catalogue> = OnceLock::new();
    let slot = if pull_request.is_some() {
        &PREVIEW
    } else {
        &LOCAL
    };
    slot.get_or_init(|| build(pull_request, "{}"))
}

pub(super) fn refused_plan() -> Catalogue {
    build(Some(123), r#"{"markerVersion":99}"#)
}

fn build(pull_request: Option<u32>, patch: &str) -> Catalogue {
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/github/upload_fixture.py");
    let number = pull_request.map_or_else(|| "null".to_owned(), |number| number.to_string());
    let output = Command::new("python3")
        .args([
            script.to_str().unwrap(),
            "mokly-ai/mokly",
            HEAD,
            "preview-seed",
            "mokly.config.json",
            &number,
            patch,
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).unwrap()
}
