//! Installed CLI discovery and published upload-exchange version compatibility.

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::input::ConfigPath;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use sandbox_interface::{ProcessStreamEvent, ProcessStreamOutcome};

use crate::command::REPO;

use super::fixtures::request;
use super::script::{Call, checkout, events, fallback, local_test, locks};
use super::support::Harness;

#[tokio::test]
async fn installed_cli_at_or_above_the_floor_publishes_with_exact_argv() {
    for version in ["0.18.0\n", "0.18.0+build.1\n", "0.19.0\n", "1.0.0-beta.1\n"] {
        let mut calls = checkout();
        calls.extend([
            locks(),
            local_test(REPO).exit(0),
            Call::new(
                BuildStep::Publish,
                "/workspace/repo/node_modules/.bin/mokly",
                &["--version"],
                REPO,
            )
            .output(version),
            Call::new(
                BuildStep::Publish,
                "/workspace/repo/node_modules/.bin/mokly",
                &[
                    "publish",
                    "--config",
                    "mokly.config.json",
                    "--repository",
                    "github.com/owner/repo",
                    "--no-changes",
                ],
                REPO,
            )
            .publishing(),
        ]);
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::Completed
        ));
    }
}

#[tokio::test]
async fn older_unparseable_and_failed_versions_never_publish() {
    for (version, status) in [
        ("0.14.0\n", 0),
        ("0.17.0\n", 0),
        ("0.17.9\n", 0),
        ("0.18.0-alpha\n", 0),
        ("mokly 0.18.0\n", 0),
        ("0.18.0\nextra\n", 0),
        ("", 0),
        ("0.18.0\n", 1),
    ] {
        let mut calls = checkout();
        let mut version_call = Call::new(
            BuildStep::Publish,
            "/workspace/repo/node_modules/.bin/mokly",
            &["--version"],
            REPO,
        );
        version_call.events = events(status, version, "");
        calls.extend([locks(), local_test(REPO).exit(0), version_call]);
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::UnsupportedMoklyVersion
        ));
    }
}

#[tokio::test]
async fn publish_failure_carries_only_the_last_plain_stderr_code() {
    let mut calls = checkout();
    calls.extend([locks(), local_test(REPO)]);
    let mut publish = fallback();
    publish.events = vec![
        ProcessStreamEvent::Started { pid: 12 },
        ProcessStreamEvent::Stdout(b"[mokly/stdout-code] ignored\n".to_vec()),
        ProcessStreamEvent::Stderr(b"[mokly/first-code] first\n[mok".to_vec()),
        ProcessStreamEvent::Stderr(b"ly/upload-failed] last\ntrailing output\n".to_vec()),
        ProcessStreamEvent::Exited {
            exit_code: 1,
            exited: true,
        },
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
    ];
    calls.push(publish);
    match Harness::new(request(), calls).run().await {
        BuildOutcome::StepFailed {
            step,
            exit_code,
            cli_error,
        } => {
            assert_eq!(step, BuildStep::Publish);
            assert_eq!(exit_code, Some(1));
            assert_eq!(cli_error, Some(MoklyCliCode::UploadFailed));
        }
        outcome => panic!("{outcome:?}"),
    }
}

#[tokio::test]
async fn publish_without_an_error_code_keeps_none() {
    let mut calls = checkout();
    calls.extend([locks(), local_test(REPO), fallback().exit(2)]);
    assert!(matches!(
        Harness::new(request(), calls).run().await,
        BuildOutcome::StepFailed {
            step: BuildStep::Publish,
            exit_code: Some(2),
            cli_error: None
        }
    ));
}

#[tokio::test]
async fn local_cli_discovery_selects_the_first_parent_with_an_executable() {
    for selected in ["/workspace/repo/packages", REPO] {
        let mut request = request();
        request.config_path = ConfigPath::new("packages/catalogue/mokly.config.json").unwrap();
        let mut calls = checkout();
        calls.push(Call::new(
            BuildStep::Install,
            "git",
            &[
                "ls-files",
                "-z",
                "--",
                "packages/catalogue/pnpm-lock.yaml",
                "packages/catalogue/yarn.lock",
                "packages/catalogue/package-lock.json",
                "packages/catalogue/npm-shrinkwrap.json",
                "packages/catalogue/bun.lock",
                "packages/catalogue/bun.lockb",
                "packages/pnpm-lock.yaml",
                "packages/yarn.lock",
                "packages/package-lock.json",
                "packages/npm-shrinkwrap.json",
                "packages/bun.lock",
                "packages/bun.lockb",
                "pnpm-lock.yaml",
                "yarn.lock",
                "package-lock.json",
                "npm-shrinkwrap.json",
                "bun.lock",
                "bun.lockb",
            ],
            REPO,
        ));
        calls.push(local_test("/workspace/repo/packages/catalogue"));
        if selected == REPO {
            calls.push(local_test("/workspace/repo/packages"));
        }
        let executable = format!("{selected}/node_modules/.bin/mokly");
        calls.extend([
            local_test(selected).exit(0),
            Call::new(BuildStep::Publish, &executable, &["--version"], REPO).output("0.18.0\n"),
            Call::new(
                BuildStep::Publish,
                &executable,
                &[
                    "publish",
                    "--config",
                    "packages/catalogue/mokly.config.json",
                    "--repository",
                    "github.com/owner/repo",
                    "--no-changes",
                ],
                REPO,
            )
            .publishing(),
        ]);
        assert!(matches!(
            Harness::new(request, calls).run().await,
            BuildOutcome::Completed
        ));
    }
}

#[tokio::test]
async fn local_cli_version_without_a_normal_exit_is_unsupported() {
    let mut calls = checkout();
    let mut version = Call::new(
        BuildStep::Publish,
        "/workspace/repo/node_modules/.bin/mokly",
        &["--version"],
        REPO,
    );
    version.events = vec![
        ProcessStreamEvent::Stdout(b"0.18.0\n".to_vec()),
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
    ];
    calls.extend([locks(), local_test(REPO).exit(0), version]);
    assert!(matches!(
        Harness::new(request(), calls).run().await,
        BuildOutcome::UnsupportedMoklyVersion
    ));
}
