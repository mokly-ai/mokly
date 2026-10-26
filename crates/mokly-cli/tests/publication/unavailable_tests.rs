//! Publish with unavailable Changes uploads only current files and null comparison metadata.

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::readers;
use mokly_test_support::receiver::{Exchange, Options};
use mokly_test_support::upload;
use regex::Regex;

use super::support::mokly;

#[test]
fn publish_with_unavailable_changes_uploads_only_current_files_and_null_comparison_metadata() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let receiver = Exchange::start(Options::default());
    let mut outputs = Outputs::default();
    write(path, "historical.json", "{invalid");
    commit_all(path, "invalid historical config");
    let base = git(path, &["rev-parse", "HEAD"]);
    git(path, &["branch", "broken-base"]);
    write(
        path,
        "historical.json",
        r#"{"review":{"base":"broken-base"}}"#,
    );
    commit_all(path, "valid current config");
    let endpoint = format!("--endpoint={}", receiver.endpoint);
    let token = format!("--token={TOKEN}");
    let rejected =
        Regex::new(r"(?m)^base [a-f0-9]+: \[mokly/config-invalid\] .*historical\.json").unwrap();
    let comparing = Regex::new("Changes ready|Changes unavailable|Comparing with").unwrap();
    for mode in ["rich", "plain"] {
        let running = mokly()
            .command(
                path,
                &[
                    "publish",
                    "--config=historical.json",
                    "--strict",
                    "--repository=example.com/team/site",
                    &endpoint,
                    &token,
                ],
                mode,
            )
            .spawn();
        receiver.observe(running.build_directory());
        let result = running.wait();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert!(result.stderr.contains(&format!("base {base}:")));
        assert!(!format!("{}{}", result.stdout, result.stderr).contains(TOKEN));
        let record = receiver.record();
        let received = record.completed_inventories.last().unwrap();
        let metadata = upload::metadata(&received["mokly-upload.json"]).unwrap();
        for field in ["baseRef", "baseSha", "comparisonPath"] {
            assert!(metadata[field].is_null(), "{field}");
        }
        let index = readers::index(&received["mokly-viewer/index.json"]);
        assert_eq!(index["changesStatus"], "unavailable");
        assert_eq!(index["base"], "broken-base");
        assert!(index["comparisonUrl"].is_null());
        assert_eq!(index["removedEntries"], serde_json::json!([]));
        assert!(
            !received
                .keys()
                .any(|name| name.starts_with("mokly-viewer/diffs/"))
        );
        let screens = index["screens"].as_array().unwrap();
        assert!(!screens.is_empty());
        assert!(screens.iter().all(|entry| {
            entry["changes"]["status"] == "unavailable"
                && entry["views"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .all(|view| view["comparison"]["status"] == "unavailable")
        }));
        if mode == "rich" {
            assert!(
                result
                    .stdout
                    .contains("Changes unavailable · base validation failed")
            );
            let unavailable = result.stdout.find("Changes unavailable").unwrap();
            assert!(unavailable < result.stdout.find("Preparing upload").unwrap());
        } else {
            assert!(rejected.is_match(&result.stderr), "{}", result.stderr);
            assert!(!comparing.is_match(&result.stdout));
            assert!(result.stdout.contains("already published for this commit"));
        }
    }
    let record = receiver.record();
    assert_eq!(record.completed, 2);
    assert_eq!(record.completed_inventories.len(), 2);
    receiver.close();
}
