//! Ready publications upload stylesheet and binary deltas and reuse an unchanged comparison.

use std::collections::BTreeMap;

use mokly_test_support::files::write;
use mokly_test_support::git::commit_all;
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::readers;
use mokly_test_support::receiver::{Exchange, Options};
use serde_json::Value;

use super::support::{CURRENT_BINARY, comparison, mokly};

const CHANGED_BINARY: [u8; 6] = [0, 253, 130, 13, 10, 3];

#[test]
fn ready_publications_upload_css_and_binary_deltas_and_reuse_a_comparison_after_an_unrelated_commit()
 {
    let fixture = comparison();
    let root = fixture.root.path();
    let receiver = Exchange::start(Options::default());
    let mut outputs = Outputs::default();
    let mut indices: Vec<Value> = Vec::new();
    for change in ["initial", "assets", "unrelated"] {
        if change == "assets" {
            write(
                root,
                "tools/theme.css",
                r#"@import "./styles/child.css"; .hero{color:green}"#,
            );
            write(root, "tools/styles/asset.png", CHANGED_BINARY);
        } else if change == "unrelated" {
            write(root, "unrelated.txt", "No rendered input changed");
        }
        if change != "initial" {
            commit_all(root, &format!("publication {change}"));
        }
        let attempts = receiver.record().attempts;
        let config = format!("--config={}", fixture.config);
        let endpoint = format!("--endpoint={}", receiver.endpoint);
        let token = format!("--token={TOKEN}");
        let running = mokly()
            .command(
                root,
                &[
                    "publish",
                    &config,
                    "--base=requested-base",
                    "--repository=example.com/team/site",
                    &endpoint,
                    &token,
                ],
                "plain",
            )
            .spawn();
        receiver.observe(running.build_directory());
        let result = running.wait();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert_eq!(result.stderr, "");
        let record = receiver.record();
        let received = record.completed_inventories.last().unwrap();
        let index = readers::index(&received["mokly-viewer/index.json"]);
        assert_eq!(index["changesStatus"], "ready");
        let asset = received
            .iter()
            .find(|(name, _)| {
                name.starts_with("static/mokly-generated/assets/")
                    && name.ends_with("/styles/asset.png")
            })
            .expect("the published image");
        let expected: &[u8] = if change == "initial" {
            &CURRENT_BINARY
        } else {
            &CHANGED_BINARY
        };
        assert_eq!(asset.1.as_slice(), expected);
        assert!(
            received
                .keys()
                .any(|name| name.starts_with("static/mokly-generated/") && name.ends_with(".css"))
        );
        let counts = record.missing_counts();
        if change == "assets" {
            assert_ne!(index["deploymentId"], indices[0]["deploymentId"]);
            assert_ne!(index["comparisonUrl"], indices[0]["comparisonUrl"]);
            assert!(counts[1] > 0);
            assert!(counts[1] < counts[0]);
        } else if change == "unrelated" {
            assert_eq!(index["deploymentId"], indices[1]["deploymentId"]);
            assert_eq!(index["comparisonUrl"], indices[1]["comparisonUrl"]);
            assert_eq!(counts[2], 0);
            assert_eq!(record.attempts, attempts);
            unchanged(received, &record.completed_inventories[1]);
        }
        indices.push(index);
    }
    assert_eq!(receiver.record().completed, 3);
    receiver.close();
}

fn unchanged(received: &BTreeMap<String, Vec<u8>>, earlier: &BTreeMap<String, Vec<u8>>) {
    for (name, bytes) in received {
        if name != ".mokly-export-artifact" && name != "mokly-upload.json" {
            assert_eq!(Some(bytes), earlier.get(name), "{name}");
        }
    }
}
