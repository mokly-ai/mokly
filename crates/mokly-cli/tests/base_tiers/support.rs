//! The binary under test, hosted CI variants, and the checked base build.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use mokly_test_support::process::{Finished, Invocation, Mokly};
use mokly_test_support::timings::timings;

/// The CI variables that a build sees.
#[derive(Clone, Copy, Debug)]
pub(super) enum Host {
    /// No `CI` and no `GITHUB_ACTIONS`.
    Local,
    /// `CI=true` and `GITHUB_ACTIONS=true`, the defaults of a hosted runner.
    Hosted,
}

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// Prepare `mokly {args}` with the fixture variables, without `removed`, for `host`.
pub(super) fn command(
    root: &Path,
    args: &[&str],
    env: &[(String, String)],
    removed: &[String],
    host: Option<Host>,
) -> Invocation {
    let mut invocation = mokly().command(root, args, "plain");
    for name in removed {
        invocation = invocation.env_remove(name);
    }
    for (name, value) in env {
        invocation = invocation.env(name, value);
    }
    match host {
        Some(Host::Local) => invocation.env_remove("CI").env_remove("GITHUB_ACTIONS"),
        Some(Host::Hosted) => invocation.env("CI", "true").env("GITHUB_ACTIONS", "true"),
        None => invocation,
    }
}

/// The parts of a base build that a test compares.
#[derive(Debug, PartialEq)]
pub(super) struct Built {
    pub(super) namespace: String,
    pub(super) tier: Option<u64>,
    pub(super) diagnostics: String,
}

/// Build against `HEAD` with timings, check the network log, and read the dependency span.
pub(super) fn build(
    root: &Path,
    env: &[(String, String)],
    removed: &[String],
    network: Option<&Path>,
    host: Host,
) -> (Built, Finished) {
    let finished = command(
        root,
        &[
            "build",
            "--base=HEAD",
            "--out=.context/site",
            "--sidecars=1",
            "--debug-timings",
        ],
        env,
        removed,
        Some(host),
    )
    .run();
    assert_eq!(finished.code, Some(0), "{}", finished.stderr);
    if let Some(network) = network {
        assert_eq!(fs::read_to_string(network).unwrap(), "");
    }
    let span = timings(&finished.stderr)
        .into_iter()
        .find(|record| record.stage() == "review.base-dependencies" && record.event() == "end")
        .unwrap_or_else(|| panic!("no dependency span: {}", finished.stderr));
    assert_eq!(span.status(), Some("ok"));
    let namespace = cache_namespace(&finished.stdout);
    let built = Built {
        namespace,
        tier: span.field("tier").as_u64(),
        diagnostics: diagnostics(&finished.stderr),
    };
    (built, finished)
}

/// The cache namespace that the build announced on standard output.
pub(super) fn cache_namespace(stdout: &str) -> String {
    stdout
        .split('\n')
        .find_map(|line| line.strip_prefix("Mokly cache: "))
        .unwrap_or_else(|| panic!("no cache line: {stdout}"))
        .to_owned()
}

/// Standard error without its timing records.
pub(super) fn diagnostics(stderr: &str) -> String {
    stderr
        .split('\n')
        .filter(|line| !line.starts_with("[mokly:timing] "))
        .collect::<Vec<_>>()
        .join("\n")
}

/// The names in `directory`, or none when it does not exist.
pub(super) fn children(directory: &Path) -> Vec<String> {
    match fs::read_dir(directory) {
        Ok(entries) => {
            let mut names: Vec<_> = entries
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .collect();
            names.sort();
            names
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Vec::new(),
        Err(error) => panic!("{error}"),
    }
}

/// Check that nothing exists at `path`.
pub(super) fn absent(path: &Path) {
    let error = fs::symlink_metadata(path).unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotFound, "{}", path.display());
}
