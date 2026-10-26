//! A cold base whose dependencies one package manager installs, with its probe and `PATH`.

use std::fs;

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use serde_json::json;

use super::cold::{ColdBase, DEPENDENCY, LIFECYCLE, cold_base};
use super::managers::Manager;
use super::probe::{Probe, instrument};

/// A manager fixture variant.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Mode {
    Installed,
    Missing,
    Version,
    Pnp,
    Paths,
    Exec,
    Constraints,
}

/// A manager fixture: the cold base, its probe, and the build environment.
pub(super) struct ManagerBase {
    pub(super) cold: ColdBase,
    pub(super) probe: Probe,
}

fn manifest(manager: &Manager, version: &str, exec: bool) -> String {
    let mut dependencies = json!({
        DEPENDENCY: format!("file:vendor/dependency-{version}.tgz"),
        "local-workspace": if manager.name == "Yarn Classic" { "*" } else { "workspace:*" },
    });
    if exec {
        dependencies["generator"] = json!("exec:./historical-generator.cjs");
    }
    json!({
        "name": "cold-base-fixture",
        "version": "1.0.0",
        "private": true,
        "packageManager": format!("{}@{}", manager.command(), manager.version),
        "workspaces": ["packages/*"],
        "dependencies": dependencies,
        "scripts": { "preinstall": LIFECYCLE, "postinstall": LIFECYCLE },
        "dependenciesMeta": { DEPENDENCY: { "built": true } },
    })
    .to_string()
}

const BERRY: &str = "nodeLinker: node-modules\nenableNetwork: false\nenableGlobalCache: false\nenableTelemetry: false\n";

/// Create the fixture of `manager` in `mode`.
pub(super) fn manager_base(manager: &Manager, mode: Mode) -> ManagerBase {
    let mut cold = cold_base(2);
    let root = cold.root.clone();
    git(&root, &["checkout", "HEAD", "--", "specs/source-value.ts"]);
    fs::remove_file(root.join("package-lock.json")).unwrap();
    fs::remove_dir_all(root.join("node_modules")).unwrap();
    write(
        &root,
        ".gitignore",
        "node_modules/\n.context/\n.yarn/install-state.gz\n",
    );
    if manager.command() == "pnpm" {
        write(&root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    } else if manager.name == "Yarn Berry" {
        write(
            &root,
            ".yarnrc.yml",
            format!("{BERRY}enableScripts: true\n"),
        );
    } else {
        write(&root, ".yarnrc", "disable-self-update-check true\n");
    }
    if mode == Mode::Constraints {
        write(
            &root,
            ".yarnrc.yml",
            format!("{BERRY}enableConstraintsChecks: true\n"),
        );
        write(
            &root,
            "yarn.config.cjs",
            "require('node:fs').writeFileSync('historical-constraints-ran', 'unexpected'); module.exports = {};\n",
        );
    }
    write(
        &root,
        "packages/local/package.json",
        json!({ "name": "local-workspace", "version": "1.0.0", "main": "index.js", "scripts": { "postinstall": LIFECYCLE } })
            .to_string(),
    );
    write(
        &root,
        "packages/local/index.js",
        "module.exports = 'Base workspace';",
    );
    write(
        &root,
        "specs/workspace.mockup.ts",
        "import {definePage} from '@mokly/mokly';\nimport value from 'local-workspace';\nexport const page = definePage({title: 'Workspace', description: '', relatedDocs: [],\nrender: () => '<!doctype html><html><head><title>Workspace</title></head><body><h1>' + value + '</h1></body></html>'});",
    );
    let exec = mode == Mode::Exec;
    write(&root, "package.json", manifest(manager, "1.0.0", false));
    if exec {
        write(
            &root,
            "packages/generator/package.json",
            json!({ "name": "generator", "version": "1.0.0" }).to_string(),
        );
        write(
            &root,
            "historical-generator.cjs",
            "require('node:fs').writeFileSync('historical-exec-ran', 'unexpected'); module.exports = {};\n",
        );
    }
    manager.install(&root, &cold.env);
    if exec {
        write(&root, "package.json", manifest(manager, "1.0.0", true));
    }
    let _ = fs::remove_file(root.join("historical-constraints-ran"));
    let _ = fs::remove_file(root.join("historical-exec-ran"));
    let escaped = "lockfile-dir=../escaped-lock\nmodules-dir=../escaped-modules\nvirtual-store-dir=../escaped-virtual\nstore-dir=../escaped-store\n";
    if mode == Mode::Paths {
        write(&root, ".npmrc", format!("offline=true\n{escaped}"));
        if manager.name != "pnpm" {
            write(
                &root,
                "pnpm-workspace.yaml",
                "packages:\n  - packages/*\nlockfileDir: ../escaped-lock\nmodulesDir: ../escaped-modules\nvirtualStoreDir: ../escaped-virtual\nstoreDir: ../escaped-store\n",
            );
        }
    }
    if mode == Mode::Version {
        write(
            &root,
            "package.json",
            manifest(manager, "1.0.0", exec).replace(manager.version, "999.0.0"),
        );
    }
    if mode == Mode::Pnp {
        write(&root, ".yarnrc.yml", "nodeLinker: pnp\n");
    }
    commit_all(&root, "manager base fixture");
    cold.base = git(&root, &["rev-parse", "HEAD"]);
    write(&root, "package.json", manifest(manager, "2.0.0", false));
    if mode == Mode::Paths {
        write(&root, ".npmrc", "offline=true\n");
        write(&root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    }
    if mode == Mode::Pnp {
        write(&root, ".yarnrc.yml", BERRY);
    }
    manager.install(&root, &cold.env);
    let _ = fs::remove_file(root.join("historical-constraints-ran"));
    write(
        &root,
        "specs/source-value.ts",
        "export const value = 'Working source';",
    );
    let _ = fs::remove_file(root.join("historical-exec-ran"));
    write(
        &root,
        "packages/local/index.js",
        "module.exports = 'Working workspace';",
    );
    let probe = instrument(&root, None);
    let path = manager.path(&root, mode == Mode::Missing);
    cold.env.push(("PATH".to_owned(), path));
    cold.env
        .push(("NODE_OPTIONS".to_owned(), probe.node_options.clone()));
    ManagerBase { cold, probe }
}
