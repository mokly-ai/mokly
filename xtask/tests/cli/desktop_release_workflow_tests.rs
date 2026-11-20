//! Desktop packaging triggers, least privilege, actions and release boundaries.

use std::fs;

use serde_json::{Value, json};

use super::support::repository;

fn workflow() -> Value {
    named_workflow("desktop-release.yml")
}

fn named_workflow(name: &str) -> Value {
    let text = fs::read_to_string(repository().join(".github/workflows").join(name)).unwrap();
    serde_saphyr::from_str(&text).unwrap()
}

fn steps(job: &Value) -> &[Value] {
    job["steps"].as_array().unwrap()
}

fn command_index(job: &Value, command: &str) -> usize {
    steps(job)
        .iter()
        .position(|step| {
            step["run"]
                .as_str()
                .is_some_and(|run| run.contains(command))
        })
        .unwrap()
}

fn action_pins_valid(source: &Value) -> bool {
    source["jobs"].as_object().unwrap().values().all(|job| {
        steps(job).iter().all(|step| {
            step["uses"].as_str().is_none_or(|action| {
                action.split_once('@').is_some_and(|(_, pin)| {
                    pin.len() == 40 && pin.bytes().all(|byte| byte.is_ascii_hexdigit())
                })
            })
        })
    })
}

#[test]
fn desktop_release_events_and_platforms_cover_both_package_modes() {
    let source = workflow();
    assert!(source["on"]["push"].is_null());
    for input in ["tag", "ref"] {
        assert_eq!(
            source["on"]["workflow_call"]["inputs"][input],
            json!({"required": true, "type": "string"})
        );
    }
    assert!(
        source["on"]
            .as_object()
            .unwrap()
            .contains_key("workflow_dispatch")
    );
    assert!(source["on"]["pull_request_target"].is_null());
    assert_eq!(
        source["on"]["pull_request"]["paths"],
        json!([
            "apps/**",
            "packages/**",
            "crates/mokly-*/**",
            "Cargo.lock",
            "rust-toolchain.toml",
            "package.json",
            "package-lock.json",
            "infra/docker/app-build-config.mjs",
            "infra/scripts/render-values.py",
            "infra/scripts/build_values.py",
            "fixtures/desktop-origin.json",
            ".nvmrc",
            ".github/workflows/desktop-release.yml"
        ])
    );
    assert_eq!(source["permissions"], json!({"contents": "read"}));
    let package = &source["jobs"]["package"];
    let release = &source["jobs"]["release"];
    assert_eq!(
        package["if"],
        "vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (github.event_name == 'pull_request' || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && !startsWith(github.ref, 'refs/tags/')))"
    );
    assert_eq!(
        release["if"],
        "vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && github.event_name == 'push' && inputs.tag != ''"
    );
    assert_eq!(release["environment"], "desktop-release");
    assert_eq!(package["env"]["MKC_BUILD_SHA"], "${{ github.sha }}");
    assert_eq!(release["env"]["MKC_BUILD_SHA"], "${{ inputs.ref }}");
    assert_eq!(release["strategy"]["max-parallel"], 1);
    for job in [package, release] {
        assert_eq!(job["permissions"], json!({"contents": "read"}));
        assert_eq!(job["runs-on"], "${{ matrix.runner }}");
        assert_eq!(job["strategy"]["fail-fast"], false);
        assert_eq!(
            job["strategy"]["matrix"]["include"],
            json!([
                {"platform": "macos", "runner": "macos-26"},
                {"platform": "linux", "runner": "ubuntu-24.04"}
            ])
        );
        assert_eq!(job["env"]["MKC_DOMAIN"], "${{ vars.MKC_DOMAIN }}");
        assert_eq!(
            job["env"]["MKC_CATALOGUE_BASE_DOMAIN"],
            "${{ vars.MKC_CATALOGUE_BASE_DOMAIN }}"
        );
        let node = steps(job)
            .iter()
            .find(|step| step["name"] == "Install Node")
            .unwrap();
        assert_eq!(node["with"]["node-version-file"], ".nvmrc");
        assert_eq!(node["with"]["cache-dependency-path"], "package-lock.json");
        for step in steps(job) {
            if step["uses"]
                .as_str()
                .is_some_and(|action| action.contains("checkout@"))
            {
                assert_eq!(step["with"]["persist-credentials"], false);
            }
            assert!(!step["run"].as_str().unwrap_or_default().contains("${{"));
        }
        assert!(
            command_index(job, "npm install --global npm@11.21.0") < command_index(job, "npm ci")
        );
        assert!(command_index(job, "npm ci") < command_index(job, "run build --workspace"));
    }
}

#[test]
fn desktop_release_pins_reject_mutable_action_references() {
    let mut source = workflow();
    assert!(action_pins_valid(&source));
    source["jobs"]["package"]["steps"][0]["uses"] = json!("useblacksmith/checkout@main");
    assert!(!action_pins_valid(&source));
}

#[test]
fn desktop_release_publisher_uses_the_updaters_public_version_tag() {
    let text =
        fs::read_to_string(repository().join("packages/desktop/electron-builder.yml")).unwrap();
    let builder: Value = serde_saphyr::from_str(&text).unwrap();
    assert_eq!(
        builder["publish"],
        json!({
            "provider": "github",
            "owner": "mokly-ai",
            "repo": "mokly-desktop",
            "releaseType": "prerelease",
            "tagNamePrefix": "v"
        })
    );
    assert_eq!(builder["mac"]["hardenedRuntime"], true);
    assert_eq!(builder["linux"]["executableName"], "mokly");
}

#[test]
fn desktop_preview_smokes_the_packages_before_upload_without_any_secret() {
    let source = workflow();
    let package = &source["jobs"]["package"];
    assert!(!package.to_string().contains("secrets."));
    assert_eq!(package["env"]["CSC_IDENTITY_AUTO_DISCOVERY"], "false");
    assert!(
        command_index(package, "release-environment.py main-preview")
            < command_index(package, "run build --workspace")
    );
    let build = command_index(package, "run build --workspace");
    let pack = command_index(package, "scripts/package.mjs preview");
    let smoke = command_index(
        package,
        "xvfb-run -a node packages/desktop/scripts/packaged-smoke.mjs",
    );
    let upload = steps(package)
        .iter()
        .position(|step| step["name"] == "Upload desktop packages")
        .unwrap();
    assert!(build < pack && pack < smoke && smoke < upload);
    assert_eq!(steps(package)[upload]["with"]["if-no-files-found"], "error");
    for extension in ["dmg", "zip", "AppImage", "deb"] {
        assert!(
            steps(package)[upload]["with"]["path"]
                .as_str()
                .unwrap()
                .contains(&format!("*.{extension}"))
        );
    }
    assert!(!package.to_string().contains("MKC_DESKTOP_UPDATES"));
    let release = &source["jobs"]["release"];
    let checkout = &steps(release)[0];
    assert_eq!(checkout["with"]["ref"], "${{ inputs.ref }}");
    let tag = command_index(release, "production --tag \"$RELEASE_TAG\"");
    assert_eq!(
        steps(release)[tag]["env"]["RELEASE_TAG"],
        "${{ inputs.tag }}"
    );
    assert!(tag < command_index(release, "npm ci"));
    let build = command_index(release, "run build --workspace");
    assert_eq!(
        steps(release)[build]["env"]["MKC_DESKTOP_UPDATES"],
        "enabled"
    );
    let mac = steps(release)
        .iter()
        .find(|step| step["name"] == "Sign, notarize and publish macOS packages")
        .unwrap();
    assert_eq!(mac["if"], "runner.os == 'macOS'");
    for secret in [
        "CSC_LINK",
        "CSC_KEY_PASSWORD",
        "APPLE_API_KEY",
        "APPLE_API_KEY_ID",
        "APPLE_API_ISSUER",
    ] {
        assert_eq!(mac["env"][secret], format!("${{{{ secrets.{secret} }}}}"));
    }
    let linux = steps(release)
        .iter()
        .find(|step| step["name"] == "Publish Linux packages")
        .unwrap();
    assert_eq!(linux["if"], "runner.os == 'Linux'");
    assert_eq!(linux["env"].as_object().unwrap().len(), 1);
    for step in [mac, linux] {
        assert_eq!(
            step["env"]["GH_TOKEN"],
            "${{ secrets.DESKTOP_RELEASES_TOKEN }}"
        );
        assert_eq!(
            step["run"],
            "node packages/desktop/scripts/package.mjs release"
        );
    }
}

#[test]
fn a_merged_desktop_release_pull_request_starts_the_release_after_the_tag_check() {
    let source = named_workflow("release.yml");
    let outputs = &source["jobs"]["release-please"]["outputs"];
    for (output, key) in [
        ("desktop_release_created", "release_created"),
        ("desktop_tag_name", "tag_name"),
        ("desktop_sha", "sha"),
    ] {
        assert_eq!(
            outputs[output],
            format!("${{{{ steps.release.outputs['packages--{key}'] }}}}")
        );
    }
    let check = &source["jobs"]["desktop-tag"];
    assert_eq!(
        check["if"],
        "vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && needs.release-please.outputs.desktop_release_created == 'true'"
    );
    assert_eq!(check["permissions"], json!({"contents": "read"}));
    assert!(
        steps(check)[0]["run"]
            .as_str()
            .unwrap()
            .contains("commits/refs/tags/$RELEASE_TAG")
    );
    let call = &source["jobs"]["desktop"];
    assert_eq!(call["needs"], json!(["release-please", "desktop-tag"]));
    assert_eq!(call["uses"], "./.github/workflows/desktop-release.yml");
    assert_eq!(
        call["with"],
        json!({
            "tag": "${{ needs.release-please.outputs.desktop_tag_name }}",
            "ref": "${{ needs.release-please.outputs.desktop_sha }}"
        })
    );
    let declared = workflow()["on"]["workflow_call"]["secrets"].clone();
    for (secret, value) in call["secrets"].as_object().unwrap() {
        assert_eq!(value, &json!(format!("${{{{ secrets.{secret} }}}}")));
        assert_eq!(declared[secret], json!({"required": false}));
    }
}
