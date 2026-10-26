//! The publish composite action installs an exact release and forwards its
//! inputs literally. The cases run the action's own `bash` steps with fake
//! `npm` and `mokly` programs. The install step also needs `node`.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use tempfile::TempDir;
use yaml_rust2::Yaml;

use crate::support::{read_yaml, repository_root, steps};

const ACTION: &str = ".github/actions/publish/action.yml";

/// A fake npm: it records its arguments and token, then installs a CLI and
/// a viewer package whose versions the test selects through the environment.
const FAKE_NPM: &str = r#"#!/bin/sh
set -eu
root=
previous=
for argument in "$@"; do
  if [ "$previous" = --prefix ]; then root=$argument; fi
  previous=$argument
done
printf '%s\0' "$@" > "$CALLS.args"
if [ "${MOKLY_TOKEN+set}" = set ]; then printf '%s' "$MOKLY_TOKEN" > "$CALLS.token"; fi
cli="$root/node_modules/@mokly/mokly"
mkdir -p "$cli"
dependencies='{"@mokly/viewer":"0.1.0"}'
if [ -n "${LEGACY_CLI-}" ]; then dependencies='{}'; fi
printf '{"name":"@mokly/mokly","version":"%s","dependencies":%s}' "$MOKLY_VERSION" "$dependencies" > "$cli/package.json"
viewer="$root/node_modules/@mokly/viewer"
mkdir -p "$viewer/dist"
printf '{"name":"@mokly/viewer","version":"%s","exports":{"./browser":"./dist/browser.js"}}' "${VIEWER_VERSION:-0.1.0}" > "$viewer/package.json"
: > "$viewer/dist/browser.js"
mkdir -p "$root/node_modules/.bin"
cat > "$root/node_modules/.bin/mokly" <<'MOKLY'
#!/bin/sh
printf '%s\0' "$@" > "$CLI_CALLS.args"
if [ "${MOKLY_TOKEN+set}" = set ]; then printf '%s' "$MOKLY_TOKEN" > "$CLI_CALLS.token"; fi
if [ "${MOKLY_ENDPOINT+set}" = set ]; then printf '%s' "$MOKLY_ENDPOINT" > "$CLI_CALLS.endpoint"; fi
MOKLY
chmod 755 "$root/node_modules/.bin/mokly"
"#;

/// One temporary action run directory with the fake npm first on `PATH`.
struct Fixture {
    root: TempDir,
    action: Yaml,
}

impl Fixture {
    fn new() -> Self {
        let root = TempDir::new().unwrap();
        let npm = root.path().join("npm");
        fs::write(&npm, FAKE_NPM).unwrap();
        fs::set_permissions(&npm, fs::Permissions::from_mode(0o755)).unwrap();
        Self {
            root,
            action: read_yaml(ACTION),
        }
    }

    fn path(&self, name: &str) -> PathBuf {
        self.root.path().join(name)
    }

    /// The `run` script of the step with the given `id`.
    fn script(&self, id: &str) -> &str {
        steps(&self.action["runs"])
            .iter()
            .find(|step| step["id"].as_str() == Some(id))
            .and_then(|step| step["run"].as_str())
            .unwrap_or_else(|| panic!("the action has a {id} step with a script"))
    }

    /// Run a step script with `bash`, the fixture environment, and overrides.
    fn run(&self, shell: &[&str], script: &str, overrides: &[(&str, &str)]) -> Output {
        let path = format!(
            "{}:{}",
            self.root.path().display(),
            std::env::var("PATH").unwrap_or_default()
        );
        let action_directory = repository_root().join(ACTION);
        Command::new("bash")
            .args(shell)
            .args(["-c", script])
            .env("PATH", path)
            .env("RUNNER_TEMP", self.root.path())
            .env("GITHUB_ACTION_PATH", action_directory.parent().unwrap())
            .env("GITHUB_OUTPUT", self.path("output"))
            .env("CALLS", self.path("calls"))
            .env("CLI_CALLS", self.path("cli"))
            .env("MOKLY_TOKEN", "")
            .envs(overrides.iter().copied())
            .output()
            .expect("bash starts")
    }
}

/// Assert a successful run and show its output otherwise.
fn assert_success(output: &Output) {
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

/// Assert a failed run whose standard error names the expected text.
fn assert_rejected(output: &Output, expected: &str) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success(), "the step must fail: {expected}");
    assert!(stderr.contains(expected), "{expected} in {stderr}");
}

/// The NUL-separated arguments that a fake program recorded.
fn recorded_arguments(prefix: &Path) -> Vec<String> {
    let bytes = fs::read(prefix.with_extension("args")).unwrap();
    let text = String::from_utf8(bytes).unwrap();
    let mut arguments: Vec<String> = text.split('\0').map(str::to_owned).collect();
    assert_eq!(arguments.pop().as_deref(), Some(""), "a final separator");
    arguments
}

/// The environment value that a fake program recorded, when it was set.
fn recorded_value(prefix: &Path, name: &str) -> Option<String> {
    fs::read_to_string(prefix.with_extension(name)).ok()
}

#[test]
fn composite_action_installs_an_exact_package_separately_and_forwards_hostile_inputs_literally() {
    let fixture = Fixture::new();
    assert_eq!(fixture.action["runs"]["using"].as_str(), Some("composite"));
    assert_eq!(
        fixture.action["inputs"]["version"]["required"],
        Yaml::Boolean(true)
    );
    let install = fixture.script("install");
    let publish = fixture.script("publish");
    assert!(!install.is_empty() && !publish.is_empty());
    assert!(!install.contains("${{"));
    assert!(!publish.contains("${{"));
    let step_env = |id: &str| {
        steps(&fixture.action["runs"])
            .iter()
            .find(|step| step["id"].as_str() == Some(id))
            .map(|step| step["env"]["MOKLY_TOKEN"].clone())
            .unwrap()
    };
    assert!(step_env("install").is_badvalue());
    assert_eq!(step_env("publish").as_str(), Some("${{ inputs.token }}"));

    let pipefail = ["-e", "-o", "pipefail"];
    assert_success(&fixture.run(&pipefail, install, &[("MOKLY_VERSION", "1.2.3-beta.1")]));
    let calls = fixture.path("calls");
    assert!(recorded_arguments(&calls).contains(&"@mokly/mokly@1.2.3-beta.1".to_owned()));
    assert_eq!(recorded_value(&calls, "token").as_deref(), Some(""));
    let output = fs::read_to_string(fixture.path("output")).unwrap();
    let bin = &output.trim()["mokly_bin=".len()..];

    let config = format!(
        "config space/$(touch {}/injected).json",
        fixture.root.path().display()
    );
    let base = "branch; echo unexpected";
    assert_success(&fixture.run(
        &pipefail,
        publish,
        &[
            ("MOKLY_BIN", bin),
            ("MOKLY_CONFIG", &config),
            ("MOKLY_BASE", base),
            ("MOKLY_NO_CHANGES", "false"),
            ("MOKLY_ENDPOINT", "https://example.com/upload"),
            ("MOKLY_TOKEN", "secret-token"),
        ],
    ));
    let cli = fixture.path("cli");
    assert_eq!(
        recorded_arguments(&cli),
        ["publish", "--config", &config, "--base", base]
    );
    assert_eq!(
        recorded_value(&cli, "token").as_deref(),
        Some("secret-token")
    );
    assert_eq!(
        recorded_value(&cli, "endpoint").as_deref(),
        Some("https://example.com/upload")
    );
    assert!(!fixture.path("injected").exists());

    assert_success(&fixture.run(
        &pipefail,
        publish,
        &[
            ("MOKLY_BIN", bin),
            ("MOKLY_CONFIG", ""),
            ("MOKLY_BASE", ""),
            ("MOKLY_NO_CHANGES", "true"),
        ],
    ));
    assert_eq!(recorded_arguments(&cli), ["publish", "--no-changes"]);
}

#[test]
fn action_rejects_mismatched_viewer_installs_and_supports_older_standalone_cli_releases() {
    let fixture = Fixture::new();
    let install = fixture.script("install");
    let pipefail = ["-e", "-o", "pipefail"];
    assert_rejected(
        &fixture.run(
            &pipefail,
            install,
            &[("MOKLY_VERSION", "0.10.0"), ("VIEWER_VERSION", "0.2.0")],
        ),
        "AssertionError",
    );
    assert_success(&fixture.run(
        &pipefail,
        install,
        &[("MOKLY_VERSION", "0.9.0"), ("LEGACY_CLI", "true")],
    ));
}

#[test]
fn action_rejects_floating_package_versions_and_invalid_boolean_options_before_execution() {
    let fixture = Fixture::new();
    let install = fixture.script("install");
    let publish = fixture.script("publish");
    for version in [
        "",
        "latest",
        "^1.2.3",
        "file:/tmp/evil",
        "1.2.3; touch bad",
        "1.2.3-01",
    ] {
        assert_rejected(
            &fixture.run(&["-e"], install, &[("MOKLY_VERSION", version)]),
            "exact SemVer",
        );
    }
    assert!(!fixture.path("calls.args").exists());
    for (no_changes, base) in [("maybe", ""), ("true", "main")] {
        assert_rejected(
            &fixture.run(
                &["-e"],
                publish,
                &[
                    ("MOKLY_BIN", "/nonexistent"),
                    ("MOKLY_CONFIG", ""),
                    ("MOKLY_BASE", base),
                    ("MOKLY_NO_CHANGES", no_changes),
                ],
            ),
            "no-changes",
        );
    }
}
