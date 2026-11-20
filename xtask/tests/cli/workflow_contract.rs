//! Typed CI workflow contracts and failing configuration fixtures.

use std::collections::BTreeMap;

use serde::Deserialize;

#[derive(Deserialize)]
struct Workflow {
    on: BTreeMap<String, Option<Event>>,
    permissions: BTreeMap<String, String>,
    concurrency: Concurrency,
    jobs: BTreeMap<String, Job>,
}

#[derive(Deserialize)]
struct Concurrency {
    group: String,
    #[serde(rename = "cancel-in-progress")]
    cancel_in_progress: bool,
}

#[derive(Deserialize)]
struct Event {
    branches: Vec<String>,
}

#[derive(Deserialize)]
struct Job {
    name: String,
    #[serde(rename = "if")]
    condition: Option<String>,
    #[serde(default)]
    needs: Vec<String>,
    steps: Vec<Step>,
    #[serde(default)]
    env: BTreeMap<String, String>,
}

#[derive(Deserialize)]
struct Step {
    uses: Option<String>,
    run: Option<String>,
    #[serde(rename = "if")]
    condition: Option<String>,
    #[serde(default)]
    with: Parameters,
    #[serde(default)]
    env: BTreeMap<String, String>,
}

#[derive(Default, Deserialize)]
struct Parameters {
    #[serde(rename = "fetch-depth")]
    fetch_depth: Option<u16>,
    #[serde(rename = "node-version-file")]
    node_version_file: Option<String>,
    #[serde(rename = "cache-dependency-path")]
    cache_dependency_path: Option<String>,
    toolchain: Option<String>,
    components: Option<String>,
    key: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Violation {
    Trigger,
    Permissions,
    Concurrency,
    ActionPin,
    RequiredGate,
    Toolchains,
    CheckCommand,
    NpmCachePath,
    Chromium,
    Postgres,
}

pub(super) fn validate(text: &str) -> Vec<Violation> {
    let workflow: Workflow = serde_saphyr::from_str(text).unwrap();
    let mut violations = Vec::new();
    if !workflow.on.contains_key("pull_request")
        || !workflow
            .on
            .get("push")
            .and_then(Option::as_ref)
            .is_some_and(|event| event.branches == ["main"])
    {
        violations.push(Violation::Trigger);
    }
    if workflow.permissions.get("contents").map(String::as_str) != Some("read") {
        violations.push(Violation::Permissions);
    }
    if workflow.concurrency.group
        != "ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}"
        || !workflow.concurrency.cancel_in_progress
    {
        violations.push(Violation::Concurrency);
    }
    let check = &workflow.jobs["check"];
    let postgres = check.steps.iter().position(|step| {
        step.condition.as_deref() == Some("matrix.postgres")
            && step.run.as_deref().is_some_and(|run| {
                run.contains("postgresql-16")
                    && run.contains("createdb mkc_test")
                    && run.contains("pg_isready")
            })
    });
    let chromium = check.steps.iter().position(|step| {
        step.condition.as_deref() == Some("matrix.browser_workspace != ''")
            && step.run.as_deref()
                == Some(
                    "npm exec --workspace \"$BROWSER_WORKSPACE\" -- playwright install --with-deps chromium",
                )
            && step.env.get("BROWSER_WORKSPACE").map(String::as_str)
                == Some("${{ matrix.browser_workspace }}")
    });
    let dependencies = check.steps.iter().position(|step| {
        step.condition.as_deref() == Some("matrix.install_dependencies")
            && step.run.as_deref() == Some("npm ci")
    });
    let verify = check.steps.iter().position(|step| {
        step.run
            .as_deref()
            .is_some_and(|run| run.contains("cargo xtask check --suite \"$XTASK_COMMAND\""))
            && step.env.get("XTASK_COMMAND").map(String::as_str) == Some("${{ matrix.command }}")
    });
    if check.env.get("MKC_TEST_DATABASE_URL").map(String::as_str)
        != Some("postgres://postgres:postgres@localhost/mkc_test")
        || !matches!((postgres, verify), (Some(database), Some(check)) if database < check)
    {
        violations.push(Violation::Postgres);
    }
    if !matches!(
        (dependencies, chromium, verify),
        (Some(dependencies), Some(browser), Some(check))
            if dependencies < browser && browser < check
    ) {
        violations.push(Violation::Chromium);
    }
    if !check.steps.iter().any(|step| {
        step.uses
            .as_deref()
            .is_some_and(|action| action.starts_with("actions/setup-node@"))
            && step.with.cache_dependency_path.as_deref() == Some("package-lock.json")
    }) {
        violations.push(Violation::NpmCachePath);
    }
    for job in workflow.jobs.values() {
        for step in &job.steps {
            if let Some(action) = &step.uses
                && !action.split_once('@').is_some_and(|(_, sha)| {
                    sha.len() == 40 && sha.bytes().all(|b| b.is_ascii_hexdigit())
                })
            {
                violations.push(Violation::ActionPin);
            }
        }
    }
    let required = &workflow.jobs["required"];
    if required.name != "Required CI"
        || required.condition.as_deref() != Some("${{ always() }}")
        || required.needs
            != [
                "profile",
                "repository",
                "viewer",
                "browser",
                "native",
                "static-delivery",
                "check",
                "images",
                "plan",
            ]
        || !required.steps.iter().any(|step| {
            step.run.as_deref().is_some_and(|run| {
                [
                    "CHECK_RESULT",
                    "IMAGE_RESULT",
                    "PLAN_RESULT",
                    "PROFILE_RESULT",
                    "REPOSITORY_RESULT",
                    "VIEWER_RESULT",
                    "BROWSER_RESULT",
                    "NATIVE_RESULT",
                    "STATIC_DELIVERY_RESULT",
                ]
                .iter()
                .all(|name| run.contains(&format!("test \"${name}\" = success")))
            }) && step.env.get("CHECK_RESULT").map(String::as_str)
                == Some("${{ needs.check.result }}")
                && step.env.get("IMAGE_RESULT").map(String::as_str)
                    == Some("${{ needs.images.result }}")
                && step.env.get("PLAN_RESULT").map(String::as_str)
                    == Some("${{ needs.plan.result }}")
        })
    {
        violations.push(Violation::RequiredGate);
    }
    if !check
        .steps
        .iter()
        .any(|step| step.with.fetch_depth == Some(0))
        || !check
            .steps
            .iter()
            .any(|step| step.with.node_version_file.as_deref() == Some(".nvmrc"))
        || !check.steps.iter().any(|step| {
            step.with.toolchain.as_deref() == Some("1.98.1")
                && step.with.components.as_deref() == Some("rustfmt, clippy")
        })
        || !check
            .steps
            .iter()
            .any(|step| step.run.as_deref() == Some("npm install --global npm@11.21.0"))
        || !check.steps.iter().any(|step| {
            step.condition.as_deref() == Some("matrix.rust_cache")
                && step.uses.as_deref()
                    == Some("Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6")
                && step.with.key.as_deref() == Some("${{ matrix.command }}")
        })
    {
        violations.push(Violation::Toolchains);
    }
    if !check.steps.iter().any(|step| {
        step.run
            .as_deref()
            .is_some_and(|run| run.contains("cargo xtask check --suite \"$XTASK_COMMAND\""))
    }) {
        violations.push(Violation::CheckCommand);
    }
    violations
}
