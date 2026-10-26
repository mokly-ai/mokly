//! Publish delivers a ready generation with the pinned merge base and exact binary bytes.

use std::path::Path;

use mokly_test_support::identity;
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::readers;
use mokly_test_support::receiver::{Exchange, Options};
use mokly_test_support::upload;
use regex::Regex;

use super::support::{CURRENT_BINARY, HISTORICAL_BINARY, comparison, in_order, mokly};

#[test]
fn publish_delivers_a_ready_generation_with_the_pinned_merge_base_and_exact_scoped_binary_bytes() {
    let fixture = comparison();
    let receiver = Exchange::start(Options::default());
    let config = format!("--config={}", fixture.config);
    let endpoint = format!("--endpoint={}", receiver.endpoint);
    let token = format!("--token={TOKEN}");
    let running = mokly()
        .command(
            fixture.root.path(),
            &[
                "publish",
                &config,
                "--base=requested-base",
                "--repository=example.com/team/site",
                &endpoint,
                &token,
            ],
            "rich",
        )
        .spawn();
    receiver.observe(running.build_directory());
    let result = running.wait();
    let mut outputs = Outputs::default();
    outputs.push(publication::directory(&result.stdout));
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(result.stderr, "");
    let record = receiver.record();
    assert_eq!(record.completed, 1);
    assert_eq!(record.completed_inventories.len(), 1);
    let received = &record.completed_inventories[0];
    let metadata = upload::metadata(&received["mokly-upload.json"]).unwrap();
    let index = readers::index(&received["mokly-viewer/index.json"]);
    assert_eq!(index["changesStatus"], "ready");
    assert_eq!(index["base"], "requested-base");
    assert_eq!(metadata["baseRef"], "requested-base");
    assert_eq!(metadata["baseSha"], fixture.base.as_str());
    assert_eq!(metadata["headSha"], fixture.head.as_str());
    assert_ne!(metadata["baseSha"], fixture.tip.as_str());
    assert_ne!(metadata["baseSha"], fixture.head.as_str());
    assert_eq!(metadata["configPath"], fixture.config);
    assert_eq!(metadata["comparisonPath"], index["comparisonUrl"]);
    let comparison_url = index["comparisonUrl"].as_str().unwrap();
    let review = readers::review(&received[comparison_url]);
    assert_eq!(review["baseCommit"], fixture.base.as_str());
    let generation = Path::new(comparison_url)
        .parent()
        .unwrap()
        .to_str()
        .unwrap();
    assert!(!received.contains_key(&format!("{generation}/snapshot.json")));
    let removed: Vec<_> = index["removedEntries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|removed| removed["entry"]["path"].as_str().unwrap())
        .collect();
    assert_eq!(removed, ["retired"]);
    assert!(received.contains_key(&format!("{generation}/entries/retired.json")));
    assert!(received.contains_key("view/retired/index.html"));
    let sides = [
        ("before", HISTORICAL_BINARY, "red|#f00", "Before"),
        ("after", CURRENT_BINARY, "blue|#00f", "After"),
    ];
    for (side, binary, colour, text) in sides {
        let prefix = format!("{generation}/snapshots/{side}/");
        let asset = received
            .iter()
            .find(|(name, _)| name.starts_with(&prefix) && name.ends_with("/styles/asset.png"))
            .expect("the side's image");
        assert_eq!(asset.1.as_slice(), binary);
        let colour = Regex::new(&format!(r"color:\s*(?:{colour})(?:[;}}\s])")).unwrap();
        assert!(received.iter().any(|(name, bytes)| {
            name.starts_with(&prefix)
                && name.ends_with(".css")
                && colour.is_match(&String::from_utf8_lossy(bytes))
        }));
        let home = &received[&format!("{prefix}mokly-generated/home/index.desktop.html")];
        assert!(String::from_utf8_lossy(home).contains(text));
    }
    identity::check(
        received,
        comparison_url,
        index["deploymentId"].as_str().unwrap(),
    );
    in_order(
        &result.stdout,
        &[
            "Loading configuration",
            "Rendering catalogue",
            "Comparing with requested-base",
            "Changes ready",
            "Writing static output",
            "Preparing upload",
            "Uploading catalogue",
            "Published Mokly catalogue",
        ],
    );
    receiver.close();
}
