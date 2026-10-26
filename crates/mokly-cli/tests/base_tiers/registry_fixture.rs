//! A cold base whose locked dependency comes from the local registry with a user token.

use std::fs;
use std::path::Path;

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use regex::Regex;
use serde_json::json;

use super::cold::{ColdBase, DEPENDENCY, LIFECYCLE, cold_base};
use super::managers::Manager;
use super::probe::{Probe, instrument};
use super::registry::Registry;

const TOKEN: &str = "user-registry-token";

/// A base configuration's attempt to read a secret during the install.
pub(super) struct Attack {
    pub(super) env: Vec<(&'static str, String)>,
    pub(super) placeholder: Option<&'static str>,
    pub(super) secret: &'static str,
    pub(super) inject: bool,
}

/// The registry fixture: the cold base, the registry, its probe, and the variables to remove.
pub(super) struct RegistryBase {
    pub(super) cold: ColdBase,
    pub(super) registry: Registry,
    pub(super) probe: Probe,
    pub(super) removed: Vec<String>,
}

fn manifest(manager: &Manager, version: &str) -> String {
    json!({
        "name": "cold-base-fixture",
        "version": "1.0.0",
        "private": true,
        "packageManager": format!("{}@{}", manager.command(), manager.version),
        "dependencies": { DEPENDENCY: version },
        "scripts": { "preinstall": LIFECYCLE, "postinstall": LIFECYCLE },
    })
    .to_string()
}

fn install(manager: &Manager, root: &Path, env: &[(String, String)], remove: &[String]) {
    let store = root.join(".context/store").display().to_string();
    let cache = root.join(".context/yarn-cache").display().to_string();
    let args: Vec<&str> = if manager.command() == "pnpm" {
        vec![
            "install",
            "--no-frozen-lockfile",
            "--ignore-scripts",
            "--ignore-pnpmfile",
            "--config.pm-on-fail=ignore",
            "--config.manage-package-manager-versions=false",
            "--store-dir",
            &store,
        ]
    } else if manager.name == "Yarn Classic" {
        vec![
            "install",
            "--ignore-scripts",
            "--non-interactive",
            "--cache-folder",
            &cache,
        ]
    } else {
        vec!["install", "--mode=skip-build"]
    };
    let args: Vec<String> = args.iter().map(|arg| (*arg).to_owned()).collect();
    manager.run(root, &args, env, &[], remove);
}

fn attack_body(attack: &Attack, host: &str, berry: bool, root: &Path) -> String {
    if attack.inject {
        let outside = root.parent().unwrap().join("outside-secret.env");
        fs::write(&outside, format!("INJECTED_SECRET={}\n", attack.secret)).unwrap();
        return format!(
            "injectEnvironmentFiles:\n  - {}\nnpmRegistries:\n  \"{host}\":\n    npmAuthToken: \"${{INJECTED_SECRET}}\"\n    npmAlwaysAuth: true\n",
            json!(outside.display().to_string())
        );
    }
    let placeholder = attack.placeholder.unwrap_or("");
    if berry {
        format!(
            "npmRegistries:\n  \"{host}\":\n    npmAuthToken: \"{placeholder}\"\n    npmAlwaysAuth: true\n"
        )
    } else {
        format!("{host}/:_authToken={placeholder}\n{host}/:always-auth=true\n")
    }
}

/// Create the registry fixture of `manager`, with an optional committed `attack`.
pub(super) fn registry_base(manager: &Manager, attack: Option<&Attack>) -> RegistryBase {
    let mut cold = cold_base(2);
    let root = cold.root.clone();
    let versions = ["1.0.0", "2.0.0"].map(|version| {
        (
            version,
            fs::read(root.join(format!("vendor/dependency-{version}.tgz"))).unwrap(),
        )
    });
    let registry = Registry::start(DEPENDENCY, versions.to_vec(), TOKEN);
    git(&root, &["checkout", "HEAD", "--", "specs/source-value.ts"]);
    fs::remove_file(root.join("package-lock.json")).unwrap();
    fs::remove_dir_all(root.join("node_modules")).unwrap();
    write(
        &root,
        ".gitignore",
        "node_modules/\n.context/\n.yarn/cache/\n.yarn/install-state.gz\n",
    );
    let host = format!("//127.0.0.1:{}", registry.port);
    let home = root.join(".context/manager-home");
    for directory in [&home, &cold.cache] {
        write(
            directory,
            ".npmrc",
            format!("{host}/:_authToken={TOKEN}\n{host}/:always-auth=true\n"),
        );
        write(
            directory,
            ".yarnrc.yml",
            format!(
                "npmRegistries:\n  \"{host}\":\n    npmAuthToken: {TOKEN}\n    npmAlwaysAuth: true\n"
            ),
        );
    }
    let berry = manager.name == "Yarn Berry";
    let project_file = if berry { ".yarnrc.yml" } else { ".npmrc" };
    let project_body = if berry {
        format!(
            "nodeLinker: node-modules\nnpmRegistryServer: \"{}\"\nunsafeHttpWhitelist:\n  - \"127.0.0.1\"\nenableGlobalCache: false\nenableTelemetry: false\n",
            registry.url
        )
    } else {
        format!("registry={}/\n", registry.url)
    };
    write(&root, project_file, &project_body);
    let configured = Regex::new("(?i)^(npm_config_|yarn_)").unwrap();
    cold.env.retain(|(name, _)| !configured.is_match(name));
    let removed: Vec<String> = std::env::vars()
        .map(|(name, _)| name)
        .filter(|name| configured.is_match(name))
        .collect();
    cold.env
        .push(("USERPROFILE".to_owned(), cold.cache.display().to_string()));
    cold.env.push((
        "npm_config_userconfig".to_owned(),
        cold.cache.join(".npmrc").display().to_string(),
    ));
    write(&root, "package.json", manifest(manager, "1.0.0"));
    let mut owner = cold.env.clone();
    owner.push(("HOME".to_owned(), home.display().to_string()));
    owner.push(("USERPROFILE".to_owned(), home.display().to_string()));
    owner.push((
        "npm_config_userconfig".to_owned(),
        home.join(".npmrc").display().to_string(),
    ));
    install(manager, &root, &owner, &removed);
    if let Some(attack) = attack {
        write(
            &root,
            project_file,
            format!("{project_body}{}", attack_body(attack, &host, berry, &root)),
        );
    }
    commit_all(&root, "registry base fixture");
    cold.base = git(&root, &["rev-parse", "HEAD"]);
    if attack.is_some() {
        write(&root, project_file, &project_body);
    }
    write(&root, "package.json", manifest(manager, "2.0.0"));
    install(manager, &root, &owner, &removed);
    write(
        &root,
        "specs/source-value.ts",
        "export const value = 'Working source';",
    );
    registry.requests.lock().unwrap().clear();
    let probe = instrument(&root, Some(registry.port));
    let path = manager.path(&root, false);
    cold.env.push(("PATH".to_owned(), path));
    cold.env
        .push(("NODE_OPTIONS".to_owned(), probe.node_options.clone()));
    for (name, value) in [
        ("HTTP_PROXY", "http://127.0.0.1:9"),
        ("HTTPS_PROXY", "http://127.0.0.1:9"),
        ("NO_PROXY", "127.0.0.1,localhost"),
    ] {
        cold.env.push((name.to_owned(), value.to_owned()));
    }
    if let Some(attack) = attack {
        for (name, value) in &attack.env {
            cold.env.push(((*name).to_owned(), value.clone()));
        }
    }
    RegistryBase {
        cold,
        registry,
        probe,
        removed,
    }
}
