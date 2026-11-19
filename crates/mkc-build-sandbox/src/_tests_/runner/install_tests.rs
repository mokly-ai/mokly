//! Lockfile precedence, supported managers and Yarn generation selection.

use mkc_build_interface::input::ConfigPath;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};

use crate::command::REPO;

use super::fixtures::request;
use super::script::{Call, checkout, fallback, fallback_for, local_test, locks};
use super::support::Harness;

#[tokio::test]
async fn every_supported_lockfile_runs_the_exact_install() {
    for (tracked, program, argv, yarn) in [
        (
            "pnpm-lock.yaml\0yarn.lock\0package-lock.json\0bun.lock\0",
            "corepack",
            vec!["pnpm", "install", "--frozen-lockfile"],
            None,
        ),
        (
            "yarn.lock\0package-lock.json\0",
            "corepack",
            vec!["yarn", "install", "--frozen-lockfile", "--non-interactive"],
            Some("1.22.22\n"),
        ),
        (
            "yarn.lock\0",
            "corepack",
            vec!["yarn", "install", "--immutable"],
            Some("4.10.0\n"),
        ),
        (
            "package-lock.json\0",
            "npm",
            vec!["ci", "--no-audit", "--no-fund"],
            None,
        ),
        (
            "npm-shrinkwrap.json\0",
            "npm",
            vec!["ci", "--no-audit", "--no-fund"],
            None,
        ),
    ] {
        let mut calls = checkout();
        calls.push(locks().output(tracked));
        if let Some(version) = yarn {
            calls.push(
                Call::new(BuildStep::Install, "corepack", &["yarn", "--version"], REPO)
                    .output(version),
            );
        }
        calls.extend([
            Call::new(BuildStep::Install, program, &argv, REPO),
            local_test(REPO),
            fallback(),
        ]);
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::Completed
        ));
    }
}

#[tokio::test]
async fn nearest_tracked_lockfile_wins_and_stops_cli_search_at_install_directory() {
    let mut request = request();
    request.config_path = ConfigPath::new("docs/catalogue/mokly.config.json").unwrap();
    let mut calls = checkout();
    calls.push(
        Call::new(
            BuildStep::Install,
            "git",
            &[
                "ls-files",
                "-z",
                "--",
                "docs/catalogue/pnpm-lock.yaml",
                "docs/catalogue/yarn.lock",
                "docs/catalogue/package-lock.json",
                "docs/catalogue/npm-shrinkwrap.json",
                "docs/catalogue/bun.lock",
                "docs/catalogue/bun.lockb",
                "docs/pnpm-lock.yaml",
                "docs/yarn.lock",
                "docs/package-lock.json",
                "docs/npm-shrinkwrap.json",
                "docs/bun.lock",
                "docs/bun.lockb",
                "pnpm-lock.yaml",
                "yarn.lock",
                "package-lock.json",
                "npm-shrinkwrap.json",
                "bun.lock",
                "bun.lockb",
            ],
            REPO,
        )
        .output("docs/package-lock.json\0pnpm-lock.yaml\0"),
    );
    calls.extend([
        Call::new(
            BuildStep::Install,
            "npm",
            &["ci", "--no-audit", "--no-fund"],
            "/workspace/repo/docs",
        ),
        local_test("/workspace/repo/docs/catalogue"),
        local_test("/workspace/repo/docs"),
        fallback_for(request.config_path.as_str(), None),
    ]);
    assert!(matches!(
        Harness::new(request, calls).run().await,
        BuildOutcome::Completed
    ));
}

#[tokio::test]
async fn bun_only_fails_but_a_supported_lockfile_in_the_same_directory_wins() {
    for file in ["bun.lock\0", "bun.lockb\0"] {
        let mut calls = checkout();
        calls.push(locks().output(file));
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::UnsupportedLockfile
        ));
    }
    let mut calls = checkout();
    calls.extend([
        locks().output("bun.lock\0package-lock.json\0"),
        Call::new(
            BuildStep::Install,
            "npm",
            &["ci", "--no-audit", "--no-fund"],
            REPO,
        ),
        local_test(REPO),
        fallback(),
    ]);
    assert!(matches!(
        Harness::new(request(), calls).run().await,
        BuildOutcome::Completed
    ));
}

#[tokio::test]
async fn install_and_yarn_probe_failures_stop_the_step() {
    for failure in ["lockfile", "version", "install"] {
        let mut calls = checkout();
        calls.push(if failure == "lockfile" {
            locks().exit(9)
        } else {
            locks().output("yarn.lock\0")
        });
        if failure != "lockfile" {
            calls.push(if failure == "version" {
                Call::new(BuildStep::Install, "corepack", &["yarn", "--version"], REPO).exit(9)
            } else {
                Call::new(BuildStep::Install, "corepack", &["yarn", "--version"], REPO)
                    .output("2.4.0\n")
            });
            if failure == "install" {
                calls.push(
                    Call::new(
                        BuildStep::Install,
                        "corepack",
                        &["yarn", "install", "--immutable"],
                        REPO,
                    )
                    .exit(9),
                );
            }
        }
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::StepFailed {
                step: BuildStep::Install,
                exit_code: Some(9),
                cli_error: None
            }
        ));
    }
}

#[tokio::test]
async fn unparseable_yarn_version_is_infrastructure_failure() {
    let mut calls = checkout();
    calls.extend([
        locks().output("yarn.lock\0"),
        Call::new(BuildStep::Install, "corepack", &["yarn", "--version"], REPO)
            .output("unknown version\n"),
    ]);
    assert!(matches!(
        Harness::new(request(), calls).run().await,
        BuildOutcome::Infrastructure(_)
    ));
}
