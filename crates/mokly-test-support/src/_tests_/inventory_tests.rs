use std::collections::BTreeMap;

use serde_json::json;

use crate::inventory::{MARKER, digest, verify};
use crate::upload::Rejection;

fn inventory(extra: &[(&str, &[u8])]) -> BTreeMap<String, Vec<u8>> {
    let mut files: BTreeMap<String, Vec<u8>> = BTreeMap::from([
        ("index.html".to_owned(), b"index".to_vec()),
        ("404.html".to_owned(), b"missing".to_vec()),
        (
            "mokly-upload.json".to_owned(),
            json!({
                "schemaVersion": 2,
                "moklyVersion": "1.0.0",
                "repository": { "host": "example.com", "owner": "team", "name": "site" },
                "branch": "main",
                "headSha": "b".repeat(40),
                "baseRef": null,
                "baseSha": null,
                "pullRequest": null,
                "configPath": "mokly.config.json",
                "exportedAt": "2026-10-26T12:00:00.000Z",
                "comparisonPath": null,
            })
            .to_string()
            .into_bytes(),
        ),
    ]);
    for (name, bytes) in extra {
        files.insert((*name).to_owned(), bytes.to_vec());
    }
    let owned: Vec<_> = files
        .iter()
        .map(|(path, bytes)| json!({ "path": path, "sha256": digest(bytes), "size": bytes.len() }))
        .collect();
    let marker = json!({ "schemaVersion": 3, "files": owned }).to_string();
    files.insert(MARKER.to_owned(), marker.into_bytes());
    files
}

#[test]
fn a_complete_inventory_passes_and_each_broken_rule_is_rejected() {
    assert_eq!(verify(&inventory(&[])).unwrap().len(), 3);
    let mut changed = inventory(&[]);
    changed.insert("index.html".to_owned(), b"changed".to_vec());
    assert_eq!(verify(&changed).map(|_| ()), Err(Rejection::Invalid));
    let mut incomplete = inventory(&[]);
    incomplete.remove("404.html");
    assert_eq!(verify(&incomplete).map(|_| ()), Err(Rejection::Invalid));
    let folded = inventory(&[("Page.html", b"a"), ("page.html", b"b")]);
    assert_eq!(verify(&folded).map(|_| ()), Err(Rejection::Invalid));
    let diffs = inventory(&[("mokly-viewer/diffs/review.json", b"{}")]);
    assert_eq!(verify(&diffs).map(|_| ()), Err(Rejection::Invalid));
}
