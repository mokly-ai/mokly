//! Publication includes the pinned comparison, and an older receiver rejects it without fallback.

use mokly_test_support::changes;
use mokly_test_support::files::tree;
use mokly_test_support::inventory;
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};
use mokly_test_support::upload;

use super::support::mokly;

#[test]
fn publication_includes_the_pinned_comparison_and_an_older_receiver_rejects_it_without_fallback() {
    let fixture = changes::fixture();
    let root = fixture.root.path();
    let local = changes::build(&mokly(), root, &[], "rich");
    let previous = tree(&local.output);
    let comparison_url = local.index["comparisonUrl"].as_str().unwrap();
    for status in [None, Some(426)] {
        let receiver = Exchange::start(Options {
            plan_status: status,
            ..Options::default()
        });
        let endpoint = format!("--endpoint={}", receiver.endpoint);
        let token = format!("--token={TOKEN}");
        let running = mokly()
            .command(
                root,
                &[
                    "publish",
                    "--repository=example.com/team/site",
                    &endpoint,
                    &token,
                ],
                if status.is_some() { "plain" } else { "rich" },
            )
            .spawn();
        receiver.observe(running.build_directory());
        let result = running.wait();
        let output = publication::directory(&result.stdout);
        let mut outputs = Outputs::default();
        outputs.push(output.clone());
        assert_eq!(
            result.code,
            Some(if status.is_some() { 1 } else { 0 }),
            "{}",
            result.stderr
        );
        let record = receiver.record();
        assert_eq!(record.bodies.len(), 1);
        assert_eq!(record.metadata[0]["baseRef"], "fixture-base");
        assert_eq!(record.metadata[0]["baseSha"], fixture.base.as_str());
        assert_eq!(record.metadata[0]["comparisonPath"], comparison_url);
        let inventory = if status.is_some() {
            tree(&output)
        } else {
            record.completed_inventories[0].clone()
        };
        inventory::verify(&inventory).expect("the receiver accepts the inventory");
        let envelope = upload::metadata(&inventory["mokly-upload.json"]).unwrap();
        assert_eq!(envelope["baseSha"], fixture.base.as_str());
        assert_eq!(envelope["comparisonPath"], comparison_url);
        for (name, bytes) in &previous {
            if name != inventory::MARKER {
                assert_eq!(inventory.get(name), Some(bytes), "{name}");
            }
        }
        if status.is_some() {
            assert!(result.stderr.contains("[mokly/upload-unsupported-version]"));
            assert_eq!(record.completed, 0);
            assert!(record.attempts.is_empty());
        } else {
            assert_eq!(record.completed, 1);
        }
        receiver.close();
    }
}
