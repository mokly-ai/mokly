//! Deployment wiring must supply the runtime's complete GitHub App key set.

#![allow(clippy::expect_used)]

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mkc_config::github::{GitHubConfigProvider, GitHubEnvironmentConfig};
use mkc_config::settings::EnvironmentMock;
use unimock::{MockFn, Unimock, matching};

const PUBLIC_SETTINGS: [&str; 3] = [
    "MKC_GITHUB_APP_ID",
    "MKC_GITHUB_CLIENT_ID",
    "MKC_GITHUB_APP_SLUG",
];
const SECRET_SETTINGS: [(&str, &str); 3] = [
    ("MKC_GITHUB_CLIENT_SECRET", "github-client-secret"),
    ("MKC_GITHUB_PRIVATE_KEY", "github-app-key"),
    ("MKC_GITHUB_WEBHOOK_SECRET", "github-webhook-secret"),
];

fn repository() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("mkc-config must remain under crates")
        .to_path_buf()
}

fn rendered_value(rendered: &str, setting: &str) -> String {
    let marker = format!("- name: {setting}\n              value: \"");
    rendered
        .split_once(&marker)
        .and_then(|(_, rest)| rest.split_once('"'))
        .map(|(value, _)| value.to_owned())
        .expect("enabled golden must render the public setting")
}

#[test]
fn enabled_chart_rendering_satisfies_the_runtime_validator() {
    let root = repository();
    let rendered = fs::read_to_string(root.join("infra/helm/tests/golden/production.yaml"))
        .expect("read enabled Helm golden");
    let entrypoint =
        fs::read_to_string(root.join("infra/docker/entrypoint.sh")).expect("read API entrypoint");
    let mut values = BTreeMap::new();
    assert!(
        entrypoint.contains("secrets_dir=${MKC_SECRETS_DIR:-/var/run/mokly-secrets}"),
        "entrypoint must read mounted secrets from /var/run/mokly-secrets by default"
    );

    for setting in PUBLIC_SETTINGS {
        values.insert(setting, rendered_value(&rendered, setting));
    }
    for (setting, file) in SECRET_SETTINGS {
        assert!(
            rendered.contains(&format!("path: \"{file}\"")),
            "CSI must mount {file}"
        );
        assert!(
            entrypoint.contains(&format!("{setting}=$(cat \"$secrets_dir/{file}\")")),
            "entrypoint must export {setting} from {file}"
        );
        let value = if setting == "MKC_GITHUB_WEBHOOK_SECRET" {
            "w".repeat(32)
        } else {
            "fixture-secret".to_owned()
        };
        values.insert(setting, value);
    }
    let environment = Arc::new(Unimock::new(
        EnvironmentMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| values.get(key).cloned())),
    ));
    let configured = GitHubEnvironmentConfig { environment }
        .load(false)
        .expect("the rendered six-setting contract must validate")
        .expect("the enabled rendering must enable GitHub");
    assert_eq!(configured.app_id, 123);
    assert_eq!(configured.app_slug, "mokly-test");
}

#[test]
fn disabled_chart_rendering_supplies_none_of_the_six_settings() {
    let rendered = fs::read_to_string(repository().join("infra/helm/tests/golden/preview-pr.yaml"))
        .expect("read disabled Helm golden");
    for setting in PUBLIC_SETTINGS {
        assert!(
            !rendered.contains(setting),
            "disabled chart rendered {setting}"
        );
    }
    for (setting, file) in SECRET_SETTINGS {
        assert!(
            !rendered.contains(setting),
            "disabled chart rendered {setting}"
        );
        assert!(!rendered.contains(file), "disabled chart mounted {file}");
    }
}
