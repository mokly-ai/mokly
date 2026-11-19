//! Origin-router deployment ownership and trust-boundary fixtures.

use std::fs;
use std::process::Command;

use super::deployment_workflow_tests::validate;
use super::support::repository;

#[test]
fn origin_router_deploys_once_on_the_trusted_main_workflow() {
    let deploy = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    assert!(!validate(&deploy, "deploy").contains(&"origin-router"));
    for changed in [
        deploy.replace(
            "${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}",
            "${{ secrets.GCP_PLAN_SERVICE_ACCOUNT }}",
        ),
        deploy.replace(
            "bash infra/scripts/deploy-origin-router.sh",
            "npm exec --workspace @mokly-cloud/worker -- wrangler deploy",
        ),
        deploy.replace(
            "origin-router:\n    name: Deploy origin router\n    if: github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true'\n    needs: [build, foundation-gate]",
            "origin-router:\n    name: Deploy origin router\n    if: github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true'\n    needs: [build]",
        ),
        deploy.replace(
            "MKC_CLOUDFLARE_ZONE_ID: ${{ vars.MKC_CLOUDFLARE_ZONE_ID }}",
            "MKC_CLOUDFLARE_ZONE_ID: ${{ vars.WRONG_ZONE_ID }}",
        ),
        deploy.replace(
            "needs: [publish, origin-router, preview-platform]",
            "needs: [publish, preview-platform]",
        ),
    ] {
        assert!(validate(&changed, "deploy").contains(&"origin-router"));
    }
    assert!(!deploy.contains("CLOUDFLARE_WORKER_API_TOKEN"));
    let exposed = deploy.replacen(
        "      CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}",
        "      CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}\n      CLOUDFLARE_API_TOKEN: ${{ secrets.SYNTHETIC_CLOUDFLARE_TOKEN }}",
        1,
    );
    assert!(validate(&exposed, "deploy").contains(&"dispatch-provider-secret"));
    let preview = fs::read_to_string(repository().join(".github/workflows/preview.yml")).unwrap();
    assert!(!preview.contains("CLOUDFLARE_WORKER_API_TOKEN"));
    assert!(!preview.contains("wrangler deploy"));

    let script =
        fs::read_to_string(repository().join("infra/scripts/deploy-origin-router.sh")).unwrap();
    assert!(script.contains("mkc-cloudflare-worker-token"));
    assert!(!script.contains("CLOUDFLARE_WORKER_API_TOKEN"));
}

#[test]
fn configured_cloud_deployment_requires_the_origin_router_before_planning() {
    let deploy = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: serde_json::Value = serde_saphyr::from_str(&deploy).unwrap();
    assert_eq!(
        workflow["jobs"]["plan-main-preview"]["if"],
        "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.publish.outputs.enabled == 'true' && needs.origin-router.outputs.enabled == 'true' && needs.preview-platform.outputs.enabled == 'true')"
    );
}

#[test]
fn aggregate_accepts_an_explicit_router_skip_only_without_cloud_deployment() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: serde_json::Value = serde_saphyr::from_str(&text).unwrap();
    let aggregate = workflow["jobs"]["required"]["steps"][0]["run"]
        .as_str()
        .unwrap();
    for (deployment, enabled, result, passed) in [
        ("true", "true", "success", true),
        ("true", "false", "success", false),
        ("false", "false", "success", true),
        ("false", "true", "failure", false),
        ("false", "false", "failure", false),
    ] {
        let status = Command::new("bash")
            .args(["-euc", aggregate])
            .env("CLOUD_DELIVERY_EXPECTED", "true")
            .env("FOUNDATION_GATE_RESULT", "success")
            .env("BUILD_RESULT", "success")
            .env("PUBLISH_RESULT", "success")
            .env("ORIGIN_ROUTER_ENABLED", enabled)
            .env("ORIGIN_ROUTER_RESULT", result)
            .env(
                "PLATFORM_RESULT",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PLATFORM_ENABLED",
                if deployment == "true" { "true" } else { "" },
            )
            .env("ENABLED", deployment)
            .env(
                "PREVIEW_PLAN",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_APPLY",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_APPLIED",
                if deployment == "true" { "true" } else { "" },
            )
            .env(
                "PREVIEW_EMAIL",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_CATALOGUE",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_CATALOGUE_COMPLETED",
                if deployment == "true" { "true" } else { "" },
            )
            .env(
                "PREVIEW_RELEASE",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_DEPLOYED",
                if deployment == "true" { "true" } else { "" },
            )
            .env(
                "PREVIEW_ARCHIVE",
                if deployment == "true" {
                    "success"
                } else {
                    "skipped"
                },
            )
            .env(
                "PREVIEW_ARCHIVE_COMPLETED",
                if deployment == "true" { "true" } else { "" },
            )
            .env("PRODUCTION_ENABLED", "false")
            .env("PRODUCTION_PLAN", "skipped")
            .env("PRODUCTION_APPLY", "skipped")
            .env("PRODUCTION_EMAIL", "skipped")
            .env("PRODUCTION_APPLIED", "")
            .env("PRODUCTION_CATALOGUE", "skipped")
            .env("PRODUCTION_CATALOGUE_COMPLETED", "")
            .env("PRODUCTION_RELEASE", "skipped")
            .env("DEPLOYED", "")
            .env("PRODUCTION_ARCHIVE", "skipped")
            .env("PRODUCTION_ARCHIVE_COMPLETED", "")
            .status()
            .unwrap();
        assert_eq!(status.success(), passed, "{deployment}/{enabled}/{result}");
    }
}

#[test]
fn workload_workflows_derive_the_shared_app_origin_without_a_site_setting() {
    for name in ["deploy", "preview"] {
        let text =
            fs::read_to_string(repository().join(format!(".github/workflows/{name}.yml"))).unwrap();
        assert!(!validate(&text, name).contains(&"site-origin"), "{name}");
        let changed = text.replacen(
            "          MKC_DOMAIN:",
            "          MKC_SITE_ORIGIN: ${{ vars.MKC_SITE_ORIGIN }}\n          MKC_DOMAIN:",
            1,
        );
        assert!(validate(&changed, name).contains(&"site-origin"), "{name}");
    }
}
