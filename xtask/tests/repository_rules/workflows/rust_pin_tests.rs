//! The Rust toolchain pin and its use by every Rust job.

use regex::Regex;

use crate::support::{action_manifests, jobs, read_text, read_yaml, steps, workflow_files};

/// The only accepted Rust setup command: rustup reads `rust-toolchain.toml`.
const TOOLCHAIN_INSTALL: &str = "rustup toolchain install";
/// Workflows whose jobs run cargo or prepare a box that runs cargo.
const RUST_WORKFLOWS: [&str; 5] = [
    "ci.yml",
    "release.yml",
    "release-prepare.yml",
    "blacksmith-testbox.yml",
    "native-bootstrap.yml",
];

/// The pin of `rust-toolchain.toml`.
struct ToolchainPin {
    channel: String,
    profile: Option<String>,
    components: Vec<String>,
}

#[test]
fn rust_toolchain_toml_pins_an_exact_release_with_rustfmt_and_clippy() {
    let pin = toolchain_pin();
    assert!(
        Regex::new(r"^[0-9]+\.[0-9]+\.[0-9]+$")
            .unwrap()
            .is_match(&pin.channel),
        "the toolchain channel must be an exact Rust release"
    );
    assert_eq!(pin.profile.as_deref(), Some("minimal"));
    let mut components = pin.components;
    components.sort();
    assert_eq!(components, ["clippy", "rustfmt"]);
}

#[test]
fn the_pinned_toolchain_is_the_workspace_rust_version_release() {
    let pin = toolchain_pin();
    let manifest = read_text("Cargo.toml");
    let rust_version = Regex::new(r#"(?m)^rust-version = "([^"]+)"$"#)
        .unwrap()
        .captures(&manifest)
        .map(|version| version[1].to_owned())
        .expect("Cargo.toml must declare a workspace rust-version");
    assert!(
        pin.channel == rust_version || pin.channel.starts_with(&format!("{rust_version}.")),
        "rust-toolchain.toml pins {} but Cargo.toml requires {rust_version}",
        pin.channel
    );
}

#[test]
fn automation_selects_rust_only_through_rust_toolchain_toml() {
    let selection =
        Regex::new(r"rustup (?:toolchain install|default|override set)[ \t]+\S").unwrap();
    for file in workflow_files().into_iter().chain(action_manifests()) {
        let source = read_text(&file);
        let found = selection.find(&source).map(|found| found.as_str());
        assert_eq!(
            found, None,
            "{file} must not name a Rust toolchain: {found:?}"
        );
    }
}

#[test]
fn rust_jobs_install_the_pinned_toolchain_before_cargo_runs() {
    let cargo = Regex::new(r"\bcargo\b").unwrap();
    let mut setups = 0;
    for file in RUST_WORKFLOWS {
        let workflow = read_yaml(&format!(".github/workflows/{file}"));
        for (name, job) in jobs(&workflow) {
            let job_steps = steps(job);
            let setup = job_steps
                .iter()
                .position(|step| step["name"].as_str() == Some("Set up Rust"));
            let first_cargo = job_steps
                .iter()
                .position(|step| cargo.is_match(step["run"].as_str().unwrap_or_default()));
            if setup.is_none() && first_cargo.is_none() {
                continue;
            }
            setups += 1;
            assert_eq!(
                setup.and_then(|setup| job_steps[setup]["run"].as_str()),
                Some(TOOLCHAIN_INSTALL),
                "{file}:{name} must set up Rust with \"{TOOLCHAIN_INSTALL}\""
            );
            if let (Some(setup), Some(first_cargo)) = (setup, first_cargo) {
                assert!(
                    setup < first_cargo,
                    "{file}:{name} must set up Rust before cargo"
                );
            }
        }
    }
    assert!(
        setups > 0,
        "CI, release and Testbox workflows must set up Rust"
    );
}

/// Read the channel, profile, and components of `rust-toolchain.toml`.
fn toolchain_pin() -> ToolchainPin {
    let source = read_text("rust-toolchain.toml");
    assert!(
        source.starts_with("[toolchain]\n"),
        "rust-toolchain.toml must start with the [toolchain] table"
    );
    let field = |pattern: &str| {
        Regex::new(pattern)
            .unwrap()
            .captures(&source)
            .map(|value| value[1].to_owned())
    };
    let channel =
        field(r#"(?m)^channel = "([^"]+)"$"#).expect("rust-toolchain.toml must set a channel");
    let components = field(r"(?m)^components = \[([^\]]*)\]$").unwrap_or_default();
    ToolchainPin {
        channel,
        profile: field(r#"(?m)^profile = "([^"]+)"$"#),
        components: Regex::new(r#""([^"]+)""#)
            .unwrap()
            .captures_iter(&components)
            .map(|component| component[1].to_owned())
            .collect(),
    }
}
