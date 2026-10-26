//! A real Git base with an npm install and an empty external Mokly cache.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::files::write;
use mokly_test_support::git::{self, git};
use mokly_test_support::npm;
use mokly_test_support::publication::temporary_root;
use serde_json::json;
use tempfile::TempDir;

/// The dependency package of every base-tier fixture.
pub(super) const DEPENDENCY: &str = "mokly-cold-dependency";

/// A lifecycle script that leaves a marker when a manager runs it.
pub(super) const LIFECYCLE: &str =
    "node -e \"require('node:fs').writeFileSync('lifecycle-ran', 'unexpected')\"";

/// A committed base with an npm install of its working dependencies.
pub(super) struct ColdBase {
    _temporary: TempDir,
    pub(super) root: PathBuf,
    pub(super) cache: PathBuf,
    pub(super) base: String,
    pub(super) env: Vec<(String, String)>,
}

struct Locked {
    version: &'static str,
    resolved: String,
    integrity: String,
}

fn archive(root: &Path, version: &'static str, label: &str) -> Locked {
    let manifest = json!({
        "name": DEPENDENCY,
        "version": version,
        "type": "module",
        "main": "index.js",
        "scripts": { "install": LIFECYCLE },
    })
    .to_string();
    let index = format!(
        "export const label = {}; export const welcome = 'Welcome';",
        json!(label)
    );
    let bytes = npm::archive(&[("package.json", &manifest), ("index.js", &index)]);
    let relative = format!("vendor/dependency-{version}.tgz");
    write(root, &relative, &bytes);
    Locked {
        version,
        resolved: format!("file:{relative}"),
        integrity: npm::integrity(&bytes),
    }
}

fn inputs(root: &Path, dependency: &Locked, resolved: &str) {
    let dependencies = json!({ DEPENDENCY: resolved });
    let mut manifest = json!({ "name": "cold-base-fixture", "version": "1.0.0" });
    manifest["dependencies"] = dependencies.clone();
    manifest["scripts"] = json!({ "preinstall": LIFECYCLE });
    write(root, "package.json", manifest.to_string());
    let mut lock = json!({ "name": "cold-base-fixture", "version": "1.0.0", "lockfileVersion": 3, "requires": true });
    lock["packages"] = json!({
        "": { "name": "cold-base-fixture", "version": "1.0.0", "dependencies": dependencies, "hasInstallScript": true },
        format!("node_modules/{DEPENDENCY}"): {
            "version": dependency.version,
            "resolved": resolved,
            "integrity": dependency.integrity,
            "hasInstallScript": true,
        },
    });
    write(root, "package-lock.json", lock.to_string());
}

fn page(title: &str, imports: &str, value: &str) -> String {
    format!(
        "import {{definePage}} from '@mokly/mokly';\n{imports}\nexport const page = definePage({{title: '{title}', description: '', relatedDocs: [],\n  render: () => '<!doctype html><html><head><title>{title}</title></head><body><h1>' + {value} + '</h1></body></html>'}});"
    )
}

/// Create the fixture for dependency `tier`: 1 locks the working archive, 2 the
/// base archive, and 3 a registry URL that an offline install cannot reach.
pub(super) fn cold_base(tier: u8) -> ColdBase {
    let temporary = tempfile::Builder::new()
        .prefix("mokly-cold-")
        .tempdir_in(temporary_root())
        .unwrap();
    let root = temporary.path().join("repository");
    let cache = temporary.path().join("cache");
    fs::create_dir(&root).unwrap();
    fs::create_dir(&cache).unwrap();
    write(&root, ".gitignore", "node_modules/\n.context/\n");
    write(
        &root,
        ".npmrc",
        "offline=true\naudit=false\nfund=false\nupdate-notifier=false\n",
    );
    write(&root, "mokly.config.json", "{}");
    let before = archive(&root, "1.0.0", "Base dependency");
    let working = archive(&root, "2.0.0", "Working dependency");
    let selected = if tier == 1 { &working } else { &before };
    let resolved = if tier == 3 {
        format!("https://registry.npmjs.org/{DEPENDENCY}/-/{DEPENDENCY}-1.0.0.tgz")
    } else {
        selected.resolved.clone()
    };
    inputs(&root, selected, &resolved);
    for (name, title, imports, value) in [
        (
            "welcome",
            "Welcome",
            format!("import {{welcome}} from '{DEPENDENCY}';"),
            "welcome",
        ),
        (
            "dependency",
            "Dependency",
            format!("import {{label}} from '{DEPENDENCY}';"),
            "label",
        ),
        (
            "source",
            "Source",
            "import {value} from './source-value';".to_owned(),
            "value",
        ),
    ] {
        write(
            &root,
            &format!("specs/{name}.mockup.ts"),
            page(title, &imports, value),
        );
    }
    write(
        &root,
        "specs/source-value.ts",
        "export const value = 'Base source';",
    );
    git::init(&root, "sha1");
    git(&root, &["config", "user.email", "test@mokly.invalid"]);
    git::commit_all(&root, "cold base fixture");
    let base = git(&root, &["rev-parse", "HEAD"]);
    inputs(&root, &working, &working.resolved);
    let npm_cache = root.join(".context/npm-cache").display().to_string();
    let mut env: Vec<(String, String)> = [
        ("npm_config_offline", "true"),
        ("npm_config_audit", "false"),
        ("npm_config_fund", "false"),
        ("npm_config_update_notifier", "false"),
        ("npm_config_ignore_scripts", "false"),
    ]
    .iter()
    .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
    .collect();
    env.push(("npm_config_cache".to_owned(), npm_cache));
    npm::run(&root, &["ci", "--ignore-scripts"], &env);
    write(
        &root,
        "specs/source-value.ts",
        "export const value = 'Working source';",
    );
    assert_eq!(git(&root, &["ls-files", "node_modules"]), "");
    assert_eq!(fs::read_dir(&cache).unwrap().count(), 0);
    for name in ["XDG_CACHE_HOME", "LOCALAPPDATA", "HOME"] {
        env.push((name.to_owned(), cache.display().to_string()));
    }
    ColdBase {
        _temporary: temporary,
        root,
        cache,
        base,
        env,
    }
}
