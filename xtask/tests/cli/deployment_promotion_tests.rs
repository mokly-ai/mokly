//! Stable releases apply their saved plans after merge and before workload rollout.

use std::fs;
use std::process::{Command, Output};

use serde_json::Value;

use super::support::repository;

fn required_result(production: &str, overrides: &[(&str, &str)]) -> Output {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: Value = serde_saphyr::from_str(&text).unwrap();
    let step = &workflow["jobs"]["required"]["steps"][0];
    let production_result = if production == "true" {
        "success"
    } else {
        "skipped"
    };
    Command::new("bash")
        .args(["-euc", step["run"].as_str().unwrap()])
        .env("FOUNDATION_GATE_RESULT", "success")
        .env("BUILD_RESULT", "success")
        .env("PUBLISH_RESULT", "success")
        .env("ORIGIN_ROUTER_ENABLED", "true")
        .env("ORIGIN_ROUTER_RESULT", "success")
        .env("PLATFORM_RESULT", "success")
        .env("PLATFORM_ENABLED", "true")
        .env("ENABLED", "true")
        .env("PREVIEW_PLAN", "success")
        .env("PREVIEW_APPLY", "success")
        .env("PREVIEW_APPLIED", "true")
        .env("PREVIEW_EMAIL", "success")
        .env("PREVIEW_CATALOGUE", "success")
        .env("PREVIEW_CATALOGUE_COMPLETED", "true")
        .env("PREVIEW_RELEASE", "success")
        .env("PREVIEW_DEPLOYED", "true")
        .env("PRODUCTION_ENABLED", production)
        .env("PRODUCTION_PLAN", production_result)
        .env("PRODUCTION_APPLY", production_result)
        .env("PRODUCTION_EMAIL", production_result)
        .env(
            "PRODUCTION_APPLIED",
            if production == "true" { "true" } else { "" },
        )
        .env("PRODUCTION_CATALOGUE", production_result)
        .env(
            "PRODUCTION_CATALOGUE_COMPLETED",
            if production == "true" { "true" } else { "" },
        )
        .env("PRODUCTION_RELEASE", production_result)
        .env("DEPLOYED", if production == "true" { "true" } else { "" })
        .envs(overrides.iter().copied())
        .output()
        .unwrap()
}

#[test]
fn invalid_production_opt_in_fails_before_any_release_work() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: Value = serde_saphyr::from_str(&text).unwrap();
    let step = &workflow["jobs"]["build"]["steps"][0];
    assert_eq!(
        step["env"]["PRODUCTION_ENABLED"],
        "${{ vars.MKC_PRODUCTION_ENABLED }}"
    );
    for value in ["", "false", "true", "TRUE", "False", "1", "tru"] {
        let result = Command::new("bash")
            .args(["-euc", step["run"].as_str().unwrap()])
            .env("PRODUCTION_ENABLED", value)
            .output()
            .unwrap();
        assert_eq!(
            result.status.success(),
            matches!(value, "" | "false" | "true")
        );
        if !result.status.success() {
            assert!(String::from_utf8_lossy(&result.stderr).contains("MKC_PRODUCTION_ENABLED"));
        }
    }
}

#[test]
fn preview_only_release_passes_until_production_is_enabled() {
    for production in ["", "false"] {
        let result = required_result(production, &[]);
        assert!(result.status.success(), "{production}: {result:?}");
        assert!(
            String::from_utf8_lossy(&result.stdout).contains("production promotion is disabled")
        );
        for job in [
            "PRODUCTION_PLAN",
            "PRODUCTION_APPLY",
            "PRODUCTION_EMAIL",
            "PRODUCTION_CATALOGUE",
            "PRODUCTION_RELEASE",
        ] {
            for status in ["success", "failure", "cancelled"] {
                assert!(
                    !required_result(production, &[(job, status)])
                        .status
                        .success()
                );
            }
        }
    }
    assert!(required_result("true", &[]).status.success());
    for production in ["TRUE", "tru", "1"] {
        assert!(!required_result(production, &[]).status.success());
    }
}

#[test]
fn enabled_stages_require_successful_smoke_and_reject_incomplete_jobs() {
    for production in ["", "false", "true"] {
        assert!(
            !required_result(production, &[("ORIGIN_ROUTER_ENABLED", "false")])
                .status
                .success()
        );
        for job in [
            "FOUNDATION_GATE_RESULT",
            "BUILD_RESULT",
            "PUBLISH_RESULT",
            "ORIGIN_ROUTER_RESULT",
            "PLATFORM_RESULT",
            "PREVIEW_PLAN",
            "PREVIEW_APPLY",
            "PREVIEW_EMAIL",
            "PREVIEW_CATALOGUE",
            "PREVIEW_RELEASE",
        ] {
            for status in ["failure", "cancelled", "skipped"] {
                assert!(
                    !required_result(production, &[(job, status)])
                        .status
                        .success()
                );
            }
        }
        for deployed in ["", "false"] {
            assert!(
                !required_result(production, &[("PLATFORM_ENABLED", deployed)])
                    .status
                    .success()
            );
            assert!(
                !required_result(production, &[("PREVIEW_APPLIED", deployed)])
                    .status
                    .success()
            );
            assert!(
                !required_result(production, &[("PREVIEW_CATALOGUE_COMPLETED", deployed)])
                    .status
                    .success()
            );
            assert!(
                !required_result(production, &[("PREVIEW_DEPLOYED", deployed)])
                    .status
                    .success()
            );
        }
    }
    for job in [
        "PRODUCTION_PLAN",
        "PRODUCTION_APPLY",
        "PRODUCTION_EMAIL",
        "PRODUCTION_CATALOGUE",
        "PRODUCTION_RELEASE",
    ] {
        for status in ["failure", "cancelled", "skipped"] {
            assert!(!required_result("true", &[(job, status)]).status.success());
        }
    }
    for deployed in ["", "false"] {
        assert!(
            !required_result("true", &[("PRODUCTION_APPLIED", deployed)])
                .status
                .success()
        );
        assert!(
            !required_result("true", &[("PRODUCTION_CATALOGUE_COMPLETED", deployed)])
                .status
                .success()
        );
        assert!(
            !required_result("true", &[("DEPLOYED", deployed)])
                .status
                .success()
        );
    }
}

#[test]
fn promotion_gate_uses_repository_opt_in_and_preview_rollout_evidence() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: Value = serde_saphyr::from_str(&text).unwrap();
    let env = &workflow["jobs"]["required"]["steps"][0]["env"];
    assert_eq!(
        env["PRODUCTION_ENABLED"],
        "${{ vars.MKC_PRODUCTION_ENABLED }}"
    );
    assert_eq!(
        env["PREVIEW_DEPLOYED"],
        "${{ needs.release-main-preview.outputs.deployed }}"
    );
    assert_eq!(
        env["FOUNDATION_GATE_RESULT"],
        "${{ needs.foundation-gate.result }}"
    );
    assert_eq!(
        env["PREVIEW_CATALOGUE_COMPLETED"],
        "${{ needs.catalogue-main-preview.outputs.completed }}"
    );
    for production in ["", "false", "true"] {
        let result = required_result(
            production,
            &[
                ("ENABLED", "false"),
                ("PLATFORM_RESULT", "skipped"),
                ("PLATFORM_ENABLED", ""),
                ("PREVIEW_PLAN", "skipped"),
                ("PREVIEW_APPLY", "skipped"),
                ("PREVIEW_APPLIED", ""),
                ("PREVIEW_EMAIL", "skipped"),
                ("PREVIEW_CATALOGUE", "skipped"),
                ("PREVIEW_CATALOGUE_COMPLETED", ""),
                ("PREVIEW_RELEASE", "skipped"),
                ("PREVIEW_DEPLOYED", ""),
                ("PRODUCTION_PLAN", "skipped"),
                ("PRODUCTION_APPLY", "skipped"),
                ("PRODUCTION_APPLIED", ""),
                ("PRODUCTION_EMAIL", "skipped"),
                ("PRODUCTION_CATALOGUE", "skipped"),
                ("PRODUCTION_CATALOGUE_COMPLETED", ""),
                ("PRODUCTION_RELEASE", "skipped"),
                ("DEPLOYED", ""),
            ],
        );
        assert!(result.status.success(), "{production}: {result:?}");
        assert!(String::from_utf8_lossy(&result.stdout).contains("no environment deployed"));
    }
}
