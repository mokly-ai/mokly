//! The release workflow selects only releases and isolates OIDC publishing.

use regex::Regex;
use yaml_rust2::Yaml;

use crate::support::{deep_equal, jobs, named, parse_yaml, read_text, steps, truthy};

/// The steps of the release preparation and publish jobs that must exist in
/// this order before publication.
const GATE_ORDER: [&str; 9] = [
    "Verify immutable tags",
    "Install dependencies",
    "Audit workspace dependencies",
    "Set up Rust",
    "Audit Rust dependencies",
    "Select verification evidence",
    "Install Chromium for verification and smoke",
    "Run complete verification",
    "Prepare exact publish artifacts",
];

/// The publication steps that must exist in this order.
const PUBLICATION_ORDER: [&str; 11] = [
    "Prepare exact publish artifacts",
    "Smoke-test exact publish artifacts",
    "Recheck immutable tags and source",
    "Preserve checked artifacts",
    "Publish and verify native packages",
    "Guard existing viewer version",
    "Publish viewer with npm trusted publishing",
    "Verify viewer registry package and provenance",
    "Guard existing CLI version",
    "Publish CLI with npm trusted publishing",
    "Verify CLI registry package and provenance",
];

#[test]
fn release_workflow_selects_only_releases_and_isolates_oidc_publish() {
    let source = read_text(".github/workflows/release.yml");
    let workflow = parse_yaml(&source, "release.yml");
    let publish = &workflow["jobs"]["publish"];
    let preparation = parse_yaml(
        &read_text(".github/workflows/release-prepare.yml"),
        "release-prepare.yml",
    );
    let prepare = &preparation["jobs"]["prepare"];
    assert!(truthy(prepare));
    let selection = &workflow["jobs"]["select-release"];
    assert!(truthy(publish));
    assert!(truthy(selection));
    let expected_input = parse_yaml(
        "description: Reuse exact-tree CI evidence or run complete verification\n\
         required: true\n\
         type: choice\n\
         options: [evidence, complete]\n\
         default: evidence\n",
        "the expected verification input",
    );
    assert!(deep_equal(
        &workflow["on"]["workflow_dispatch"]["inputs"]["verification"],
        &expected_input
    ));
    assert_eq!(
        workflow["concurrency"]["cancel-in-progress"],
        Yaml::Boolean(false)
    );
    assert_eq!(publish["environment"].as_str(), Some("npm"));
    assert_eq!(publish["runs-on"].as_str(), Some("ubuntu-24.04"));
    let checkout = step(publish, "Check out immutable release tag")["uses"]
        .as_str()
        .unwrap_or_default();
    assert!(
        Regex::new(r"^actions/checkout@[a-f0-9]{40}$")
            .unwrap()
            .is_match(checkout),
        "{checkout}"
    );
    assert!(deep_equal(
        &publish["permissions"],
        &parse_yaml(
            "actions: read\ncontents: read\nid-token: write\n",
            "the expected publish permissions",
        )
    ));
    assert_eq!(
        selection["outputs"]["verification"].as_str(),
        Some("${{ steps.select.outputs.verification }}")
    );
    assert_eq!(
        prepare["env"]["RELEASE_VERIFICATION"].as_str(),
        Some("${{ inputs.verification }}")
    );
    assert!(!source.contains("NPM_TOKEN"));
    assert!(!source.contains("NODE_AUTH_TOKEN"));
    for pattern in [
        r"package-manager-cache: false",
        r#"npm publish "\$ARCHIVE_PATH" --access public"#,
        r"--mode guard",
        r"--mode verify",
        r"release-please-action@[a-f0-9]{40}",
    ] {
        assert!(Regex::new(pattern).unwrap().is_match(&source), "{pattern}");
    }

    let names: Vec<Option<&str>> = steps(prepare)
        .iter()
        .chain(steps(publish))
        .map(|step| step["name"].as_str())
        .collect();
    assert_order(&names, &GATE_ORDER);
    assert_eq!(
        step(prepare, "Audit workspace dependencies")["run"].as_str(),
        Some("npm run dependencies:check")
    );
    let verification = step(prepare, "Run complete verification");
    assert_eq!(
        verification["run"].as_str(),
        Some(r#"GITHUB_SHA="$(git rev-parse HEAD)" cargo xtask check --dependency-audit strict"#)
    );
    assert_eq!(
        verification["env"]["PLAYWRIGHT_CHANNEL"].as_str(),
        Some("chromium")
    );
    assert_eq!(
        step(prepare, "Install Chromium for verification and smoke")["run"].as_str(),
        Some("npx playwright install --with-deps chromium")
    );
    assert_eq!(
        verification["if"].as_str(),
        Some("steps.evidence.outputs.mode != 'evidence'")
    );
    for name in ["Set up Rust", "Audit Rust dependencies"] {
        assert!(
            step(prepare, name)["if"].is_badvalue(),
            "{name} must run with reused evidence too"
        );
    }
    assert_eq!(
        step(prepare, "Audit Rust dependencies")["run"].as_str(),
        Some("npm run dependencies:check:rust")
    );
    let evidence = step(prepare, "Select verification evidence");
    assert_eq!(evidence["id"].as_str(), Some("evidence"));
    assert!(deep_equal(
        &evidence["env"],
        &parse_yaml(
            "GITHUB_TOKEN: ${{ github.token }}\n",
            "the expected evidence environment",
        )
    ));
    let token_steps: Vec<Option<&str>> = steps(prepare)
        .iter()
        .filter(|step| truthy(&step["env"]["GITHUB_TOKEN"]))
        .map(|step| step["name"].as_str())
        .collect();
    assert_eq!(
        token_steps,
        [
            Some("Resolve checked archives for publication"),
            Some("Select verification evidence"),
        ]
    );
    let preserved = step(prepare, "Preserve checked artifacts")["with"]["path"]
        .as_str()
        .unwrap_or_default();
    assert!(
        preserved.contains(".context/release-evidence/record.json"),
        "{preserved}"
    );
    assert!(
        index_of(&names, "Guard existing viewer version")
            < index_of(&names, "Publish viewer with npm trusted publishing")
    );
    assert_order(&names, &PUBLICATION_ORDER);
    for pattern in [
        r"group: npm-release",
        r#"verify-ref\.mjs "\$PUBLISH_REF""#,
        r"--artifacts .context/release-artifact",
    ] {
        assert!(Regex::new(pattern).unwrap().is_match(&source), "{pattern}");
    }
    assert_eq!(
        setup_node(publish)["with"]["node-version"].as_str(),
        Some("${{ needs.prepare-release.outputs.node_version }}")
    );
    assert_eq!(
        setup_node(prepare)["with"]["node-version"].as_i64(),
        Some(24)
    );
    assert_pinned_actions(&workflow);
    assert_pinned_actions(&preparation);
}

/// The first step of a job with the given name, or a missing value.
fn step<'a>(job: &'a Yaml, name: &str) -> &'a Yaml {
    named(steps(job), name).unwrap_or(&Yaml::BadValue)
}

/// The first `actions/setup-node` step of a job, or a missing value.
fn setup_node(job: &Yaml) -> &Yaml {
    steps(job)
        .iter()
        .find(|step| {
            step["uses"]
                .as_str()
                .is_some_and(|uses| uses.starts_with("actions/setup-node@"))
        })
        .unwrap_or(&Yaml::BadValue)
}

/// The first index of a step name, or -1 as JavaScript's `indexOf` returns.
fn index_of(names: &[Option<&str>], name: &str) -> isize {
    names
        .iter()
        .position(|candidate| *candidate == Some(name))
        .map_or(-1, |index| index as isize)
}

/// Every name exists, and each first occurrence follows the one before it.
fn assert_order(names: &[Option<&str>], order: &[&str]) {
    for (index, name) in order.iter().enumerate() {
        assert!(names.contains(&Some(*name)), "{name}");
        if index > 0 {
            assert!(
                index_of(names, order[index - 1]) < index_of(names, name),
                "{name}"
            );
        }
    }
}

/// Every step action of a workflow pins a 40-character commit revision.
fn assert_pinned_actions(workflow: &Yaml) {
    let pinned = Regex::new(r"@[a-f0-9]{40}$").unwrap();
    let actions: Vec<&str> = jobs(workflow)
        .into_iter()
        .flat_map(|(_, job)| steps(job))
        .filter(|step| truthy(&step["uses"]))
        .map(|step| step["uses"].as_str().expect("uses is text"))
        .collect();
    assert!(!actions.is_empty());
    for action in actions {
        assert!(pinned.is_match(action), "{action}");
    }
}
