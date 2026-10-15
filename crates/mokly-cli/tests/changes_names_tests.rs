//! Native comparison composition reports exact named entries with isolated caches.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildChanges, BuildService, CatalogueBuild};
use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::grammar::{Build, Common};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use tempfile::TempDir;
use unimock::Unimock;

#[path = "../src/base_dependencies.rs"]
mod base_dependencies;
#[path = "../src/changes_base.rs"]
mod changes_base;
#[path = "../src/changes_runtime.rs"]
mod changes_runtime;
#[path = "../src/render_runtime.rs"]
mod render_runtime;
#[path = "../src/terminal.rs"]
#[expect(dead_code, reason = "this build probe uses only terminal stdout")]
mod terminal;

#[expect(
    dead_code,
    reason = "this probe uses native composition instead of the CLI helper"
)]
mod changes_support;
use changes_support::{base, write};

const TEST: &str = "mixed_comparison_names_each_changed_entry";
const CARD: &str = "import {defineComponent} from '@mokly/mokly'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],props:{},element:'ui-card',propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <p className='card'>Before</p>});";
const HOME: &str = "---\ntitle: Home\n---\n<h1 class=\"html-title\">Before</h1><ui-card></ui-card>";

#[test]
fn mixed_comparison_names_each_changed_entry() {
    if let Some(root) = env::var_os("MOKLY_TEST_COMPARISON_ROOT") {
        inspect(&PathBuf::from(root));
        return;
    }
    for change in ["none", "html", "react", "css", "all"] {
        let root = base(&[
            (
                "mokly.config.json",
                r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
            ),
            ("specs/card.mockup.tsx", CARD),
            ("specs/home.screen.html", HOME),
            ("style.css", ".html-title{color:red}"),
        ]);
        let modules = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
        #[cfg(unix)]
        std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
        if matches!(change, "html" | "all") {
            write(
                root.path(),
                "specs/home.screen.html",
                &HOME.replace("Before", "After"),
            );
        }
        if matches!(change, "react" | "all") {
            write(
                root.path(),
                "specs/card.mockup.tsx",
                &CARD.replace("Before", "After"),
            );
        }
        if matches!(change, "css" | "all") {
            write(root.path(), "style.css", ".html-title{color:blue}");
        }
        let expected = match change {
            "none" => vec![],
            "react" => vec!["card"],
            "all" => vec!["card", "home"],
            _ => vec!["home"],
        };
        let cache = TempDir::new().unwrap();
        let output = Command::new(env::current_exe().unwrap())
            .args(["--exact", TEST, "--nocapture"])
            .env("MOKLY_TEST_COMPARISON_ROOT", root.path())
            .env(
                "MOKLY_TEST_EXPECTED_CHANGES",
                serde_json::to_string(&expected).unwrap(),
            )
            .env("XDG_CACHE_HOME", cache.path())
            .env("HOME", cache.path())
            .env("LOCALAPPDATA", cache.path())
            .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
            .env_remove("MOKLY_SIDECARS")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{change}: {}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

fn inspect(root: &Path) {
    let common = Common {
        config: env::var("MOKLY_TEST_CONFIG").ok(),
        base: env::var("MOKLY_TEST_BASE").ok(),
        sidecars: Some(std::thread::available_parallelism().map_or(1, usize::from)),
        ..Common::default()
    };
    let tree = Arc::new(WorkingTree);
    let loader = Arc::new(Loader { tree: tree.clone() });
    let config = loader.load(root, common.config.as_deref()).unwrap();
    let cancellation = Arc::new(BuildCancellation::new(Arc::new(Unimock::new(()))));
    let redactor = Arc::new(Redactor::default());
    let services = render_runtime::Services::new(
        tree.clone(),
        root,
        &config.repo_root,
        &common,
        redactor.clone(),
        cancellation.clone(),
    )
    .unwrap();
    let service: &dyn BuildService = &CatalogueBuild {
        changes: changes_runtime::service(
            services.runtime.clone(),
            cancellation.clone(),
            Arc::new(terminal::SystemTerminal::default()),
            Style {
                mode: Mode::Plain,
                color: false,
                ascii: true,
                columns: 120,
            },
            redactor,
        ),
        cancellation,
        config: loader,
        catalogue: Arc::new(Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree }),
            definitions: services.runtime.clone(),
        }),
        graphs: services.runtime.clone(),
    };
    let result = service.run(
        root,
        &Build {
            common,
            out: None,
            strict: true,
            no_changes: false,
        },
    );
    services.pool.shutdown().unwrap();
    let summary = result.unwrap();
    assert!(summary.warnings.is_empty(), "{:?}", summary.warnings);
    let BuildChanges::Ready(changes) = summary.changes else {
        panic!("{:?}", summary.changes)
    };
    let mut names: Vec<_> = changes
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.clone())
        .collect();
    names.sort();
    let expected: Vec<String> =
        serde_json::from_str(&env::var("MOKLY_TEST_EXPECTED_CHANGES").unwrap()).unwrap();
    if env::var_os("MOKLY_TEST_CHANGED_SUBSET").is_some() {
        assert!(!expected.is_empty());
        for name in expected {
            assert!(
                names.contains(&name),
                "expected changed entry {name}: {names:?}"
            );
        }
    } else {
        assert_eq!(names, expected);
    }
    assert_eq!(names.len(), changes.counts.changes);
    println!(
        "Changed entries: {}",
        serde_json::to_string(&names).unwrap()
    );
    if let Some(path) = env::var_os("MOKLY_TEST_REVIEW_OUTPUT") {
        fs::write(path, serde_json::to_vec_pretty(&changes.review).unwrap()).unwrap();
    }
}
