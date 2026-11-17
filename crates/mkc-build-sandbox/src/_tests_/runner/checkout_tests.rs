//! Full comparison fetch ladder and first-failure behavior.

use mkc_build_interface::input::Branch;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::Comparison;

use crate::command::REPO;

use super::fixtures::{SHA, request};
use super::script::{Call, checkout, checkout_end, fallback, local_test, locks};
use super::support::Harness;

#[tokio::test]
async fn current_only_runs_exact_commands_and_step_notifications() {
    let mut calls = checkout();
    calls.extend([locks(), local_test(REPO), fallback()]);
    let harness = Harness::new(request(), calls);
    assert!(matches!(harness.run().await, BuildOutcome::Completed));
    assert_eq!(
        *harness.steps.lock().unwrap(),
        [BuildStep::Checkout, BuildStep::Install, BuildStep::Publish]
    );
}

#[tokio::test]
async fn comparison_uses_the_full_fetch_ladder_only_when_needed() {
    for (first, second, shallow) in [
        (0, 0, true),
        (1, 0, true),
        (1, 1, true),
        (1, 1, false),
        (128, 128, true),
    ] {
        let mut request = request();
        request.comparison = Comparison::Base {
            base_ref: Branch::new("main").unwrap(),
        };
        let step = BuildStep::Checkout;
        let mut calls = checkout();
        calls.truncate(3);
        calls.push(Call::new(
            step,
            "git",
            &[
                "fetch",
                "--no-tags",
                "--progress",
                "--depth=50",
                "origin",
                SHA,
                "+refs/heads/main:refs/remotes/origin/main",
            ],
            REPO,
        ));
        let merge = || Call::new(step, "git", &["merge-base", "--", "origin/main", SHA], REPO);
        calls.push(merge().exit(first));
        if first != 0 {
            calls.push(Call::new(
                step,
                "git",
                &[
                    "fetch",
                    "--no-tags",
                    "--progress",
                    "--deepen=1000",
                    "origin",
                    SHA,
                    "+refs/heads/main:refs/remotes/origin/main",
                ],
                REPO,
            ));
            calls.push(merge().exit(second));
            if second != 0 {
                calls.push(
                    Call::new(step, "git", &["rev-parse", "--is-shallow-repository"], REPO)
                        .output(if shallow { "true\n" } else { "false\n" }),
                );
                if shallow {
                    calls.push(Call::new(
                        step,
                        "git",
                        &[
                            "fetch",
                            "--no-tags",
                            "--progress",
                            "--unshallow",
                            "origin",
                            SHA,
                            "+refs/heads/main:refs/remotes/origin/main",
                        ],
                        REPO,
                    ));
                }
            }
        }
        calls.extend([
            checkout_end(),
            locks(),
            local_test(REPO),
            Call::new(
                BuildStep::Publish,
                "npm",
                &[
                    "exec",
                    "--yes",
                    "--package=@mokly/mokly@0.19.0",
                    "--",
                    "mokly",
                    "publish",
                    "--config",
                    "mokly.config.json",
                    "--repository",
                    "github.com/owner/repo",
                    "--base",
                    "origin/main",
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
async fn checkout_stops_at_each_first_failing_process() {
    for index in 0..5 {
        let mut calls = checkout();
        calls.truncate(index + 1);
        let last = calls.pop().unwrap().exit(42);
        calls.push(last);
        assert!(matches!(
            Harness::new(request(), calls).run().await,
            BuildOutcome::StepFailed {
                step: BuildStep::Checkout,
                exit_code: Some(42),
                cli_error: None
            }
        ));
    }
}
