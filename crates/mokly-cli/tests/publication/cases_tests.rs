//! Environment credentials, nested configuration, strict warnings, and refused outputs.

use std::fs;
use std::io::Write;
use std::path::Path;

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};

use super::support::mokly;

fn append(path: &Path, text: &str) {
    fs::OpenOptions::new()
        .append(true)
        .open(path)
        .unwrap()
        .write_all(text.as_bytes())
        .unwrap();
}

#[test]
fn environment_credentials_and_nested_configuration_publish_a_delta_after_an_entry_edit() {
    let root = publication::fixture(false, "sha256");
    let path = root.path();
    let receiver = Exchange::start(Options::default());
    let mut outputs = Outputs::default();
    fs::create_dir(path.join("tools")).unwrap();
    write(path, "tools/mokly.config.json", "{}");
    fs::rename(path.join("specs"), path.join("tools/specs")).unwrap();
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "changed"]);
    for change in ["initial", "entry", "unrelated"] {
        if change == "entry" {
            append(&path.join("tools/specs/home.screen.html"), "<p>Changed</p>");
            commit_all(path, "changed");
        }
        if change == "unrelated" {
            append(&path.join("signal.txt"), "other input");
            commit_all(path, "changed");
        }
        let previous = receiver.record().attempts;
        let args = publication::publish_args(
            &receiver.endpoint,
            true,
            &["--config=tools/mokly.config.json"],
        );
        let args: Vec<_> = args.iter().map(String::as_str).collect();
        let result = mokly()
            .command(path, &args, "plain")
            .env("MOKLY_ENDPOINT", &receiver.endpoint)
            .env("MOKLY_TOKEN", TOKEN)
            .run();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert_eq!(result.stderr, "");
        assert!(result.stdout.contains("Published Mokly catalogue"));
        if change == "unrelated" {
            assert_eq!(receiver.record().attempts, previous);
            assert!(result.stdout.contains("1 file uploaded"));
        }
    }
    let record = receiver.record();
    let counts = record.missing_counts();
    let head = |index: usize| record.metadata[index]["headSha"].as_str().unwrap();
    assert_eq!(record.metadata[0]["configPath"], "tools/mokly.config.json");
    assert_eq!(head(0).len(), 64);
    assert_ne!(head(0), head(1));
    assert!(counts[0] > counts[1]);
    assert!(counts[1] > 0);
    assert_ne!(head(1), head(2));
    assert_eq!(counts[2], 0);
    assert_eq!(record.completed, 3);
    receiver.close();
}

#[test]
fn publish_warnings_allow_upload_unless_strict_mode_is_requested() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let receiver = Exchange::start(Options::default());
    let mut outputs = Outputs::default();
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Unused}\n---\n<p>Home</p>",
    );
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "changed"]);
    for strict in [true, false] {
        let extra: &[&str] = if strict { &["--strict"] } else { &[] };
        let result = publication::publish(&mokly(), path, &receiver.endpoint, "plain", extra).run();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(
            result.code,
            Some(if strict { 1 } else { 0 }),
            "{}",
            result.stderr
        );
        assert_eq!(result.stderr.matches("[mokly/warning]").count(), 1);
        assert_eq!(result.stderr.contains("with --strict"), strict);
        let record = receiver.record();
        assert_eq!(record.completed, if strict { 0 } else { 1 });
        if strict {
            assert!(record.bodies.is_empty());
        } else {
            assert!(result.stdout.contains("Published Mokly catalogue"));
        }
    }
    assert_eq!(receiver.record().bodies.len(), 1);
    receiver.close();
}

#[test]
fn an_invalid_output_is_refused_before_git_history_work_and_author_execution() {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(path, "unowned/keep", "keep");
    let result = mokly()
        .command(
            path,
            &["build", "--out=unowned", "--base=absent-ref"],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(1));
    assert!(result.stderr.contains("[mokly/export-invalid]"));
    assert!(!result.stderr.contains("git-failed"));
    assert_eq!(
        fs::read_to_string(path.join("unowned/keep")).unwrap(),
        "keep"
    );
}
