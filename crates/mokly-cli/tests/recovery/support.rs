//! The recovery fixture, fault-injected commands, and recovery assertions.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::files::{tree, write};
use mokly_test_support::git::git;
use mokly_test_support::process::{Finished, Invocation, Mokly};
use mokly_test_support::publication;
use regex::Regex;
use serde_json::Value;
use tempfile::TempDir;

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// A publication fixture with a previous build in `.context/previous` and a new committed site.
pub(super) fn recovery_fixture() -> TempDir {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let result = mokly()
        .command(
            path,
            &["build", "--no-changes", "--out=.context/previous"],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>New site</h1>",
    );
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "new site"]);
    root
}

/// Prepare `verb` with the static fault adapters `faults` and their marker paths.
pub(super) fn fault_command(
    root: &Path,
    verb: &str,
    faults: &str,
    mode: &str,
    output: &str,
) -> Invocation {
    let out = format!("--out={output}");
    let args = if verb == "publish" {
        publication::publish_args("http://127.0.0.1:1/plan", false, &[])
    } else {
        vec!["build".to_owned(), "--no-changes".to_owned(), out]
    };
    let args: Vec<_> = args.iter().map(String::as_str).collect();
    mokly()
        .command(root, &args, mode)
        .env("MOKLY_TEST_STATIC_FAULTS", faults)
        .env("MOKLY_TEST_STATIC_COLUMNS", "500")
        .env("MOKLY_TEST_STATIC_EVENTS", root.join(".context/events"))
        .env("MOKLY_TEST_STATIC_PREVIOUS", root.join(".context/previous"))
        .env("MOKLY_TEST_STATIC_READY", root.join(".context/ready"))
}

/// The output folder of `verb`: the reported private build, or `.context/site`.
pub(super) fn output_directory(root: &Path, verb: &str, stdout: &str) -> PathBuf {
    if verb == "publish" {
        publication::directory(stdout)
    } else {
        root.join(".context/site")
    }
}

/// The reservation folder that holds the recovery files of `output`.
pub(super) fn reservation(output: &Path) -> PathBuf {
    output
        .parent()
        .unwrap()
        .join(".mokly-export-reservations/locks")
        .join(output.file_name().unwrap())
}

/// Remove the private publish root of `output`.
pub(super) fn remove_private(verb: &str, output: &Path) {
    if verb == "publish" {
        let _ = fs::remove_dir_all(output.parent().unwrap());
    }
}

/// Check that the only error category is `[mokly/export-invalid]`.
pub(super) fn export_category(stderr: &str) {
    let categories: Vec<_> = Regex::new(r"\[mokly/[^\]]+\]")
        .unwrap()
        .find_iter(stderr)
        .map(|found| found.as_str())
        .collect();
    assert_eq!(categories, ["[mokly/export-invalid]"], "{stderr}");
}

/// Check that `primary` occurs before `cleanup` in `stderr`.
pub(super) fn causes(stderr: &str, primary: &str, cleanup: &str) {
    let first = stderr.find(primary);
    let second = stderr.find(cleanup);
    assert!(
        first.is_some(),
        "Missing primary cause {primary}:\n{stderr}"
    );
    assert!(
        second.is_some(),
        "Missing cleanup cause {cleanup}:\n{stderr}"
    );
    assert!(first < second, "{stderr}");
}

/// The message of an unexpected output entry at `path`.
pub(super) fn unsafe_entry(path: &Path) -> String {
    format!("Unexpected or unsafe output entry at {}.", path.display())
}

/// The recovery path as `verb` prints it: relative for build, absolute for publish.
pub(super) fn recovery_path(root: &Path, path: &Path, verb: &str) -> String {
    if verb == "build" {
        path.strip_prefix(root).unwrap().display().to_string()
    } else {
        path.display().to_string()
    }
}

/// `stderr` with the private root and the fixture root replaced by placeholders.
pub(super) fn normalized(stderr: &str, root: &Path, output: &Path, verb: &str) -> String {
    let mut text = stderr.to_owned();
    if verb == "publish" {
        text = text.replace(&output.parent().unwrap().display().to_string(), "{private}");
    }
    text.replace(&root.display().to_string(), "{root}")
        .replace(std::path::MAIN_SEPARATOR, "/")
}

/// Check that `output` holds exactly the bytes of a fresh build, apart from the upload file.
pub(super) fn installed_bytes(root: &Path, output: &Path, verb: &str) {
    let built = mokly()
        .command(
            root,
            &["build", "--no-changes", "--out=.context/expected"],
            "plain",
        )
        .run();
    assert_eq!(built.code, Some(0), "{}", built.stderr);
    let expected = tree(&root.join(".context/expected"));
    let mut actual: BTreeMap<_, _> = tree(output);
    if verb == "publish" {
        assert!(actual.remove("mokly-upload.json").is_some());
        let marker = ".mokly-export-artifact";
        let mut inventory: Value = serde_json::from_slice(&actual[marker]).unwrap();
        let files = inventory["files"].as_array_mut().unwrap();
        let upload = |file: &Value| file["path"] == "mokly-upload.json";
        assert_eq!(files.iter().filter(|file| upload(file)).count(), 1);
        files.retain(|file| !upload(file));
        let wanted: Value = serde_json::from_slice(&expected[marker]).unwrap();
        assert_eq!(inventory, wanted);
        actual.insert(marker.to_owned(), expected[marker].clone());
    }
    assert!(
        actual == expected,
        "the installed bytes differ from a fresh build"
    );
}

/// Run `verb` with `fault`, send SIGINT at the fault's signal gate, and wait.
pub(super) fn signal_fault(root: &Path, verb: &str, mode: &str, fault: &str) -> Finished {
    let expected = fault.split(',').next().unwrap();
    let ready = root.join(".context/ready");
    let mut running = fault_command(root, verb, fault, mode, ".context/site").spawn();
    let started = Instant::now();
    while fs::read_to_string(&ready).ok().as_deref() != Some(expected) {
        assert!(
            !running.has_exited(),
            "No fault readiness: {}",
            running.stderr()
        );
        assert!(
            started.elapsed() < Duration::from_secs(120),
            "the fault gate never became ready"
        );
        thread::sleep(Duration::from_millis(10));
    }
    running.signal("INT");
    running.wait()
}
