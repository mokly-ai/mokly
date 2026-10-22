//! Base preparation results select the extraction and retain its dependency leases.

use std::process::Command;
use std::sync::Arc;
use std::{env, fs};

use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_graph::types::GraphFactory;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::{Call, ModuleResolution};
use unimock::Unimock;

use super::support::{Consumer, workspace};

#[test]
fn base_renders_its_own_sources_and_holds_both_leases_until_the_graph_closes() {
    if inherited_head_environment() {
        return;
    }
    let head = Consumer::single();
    let base = Consumer::new();
    fs::write(head.root().join("head-only.txt"), "head secret").unwrap();
    for (consumer, text) in [(&head, "head cwd"), (&base, "base cwd")] {
        fs::write(consumer.root().join("cwd.txt"), text).unwrap();
        let color = if text == "head cwd" {
            "var(--head-cwd)"
        } else {
            "var(--base-cwd)"
        };
        fs::write(
            consumer.root().join("tokens.json"),
            format!(r#"{{"color":"{color}"}}"#),
        )
        .unwrap();
        consumer.replace(
            "specs/screen.mockup.tsx",
            "export default defineScreen({",
            "import {readFileSync} from 'node:fs';\nconst loaded = readFileSync(process.cwd() + '/cwd.txt', 'utf8');\nconst fromEnvironment = readFileSync(process.env.PWD + '/cwd.txt', 'utf8');\nconst npmRoots = [process.env.INIT_CWD,process.env.npm_package_json,process.env.npm_config_local_prefix].map(value=>value??'unset').join(':');\nfunction exclusive() { try { return readFileSync('head-only.txt','utf8'); } catch (error) { return error.code; } }\nexport default defineScreen({",
        );
        consumer.replace(
            "specs/screen.mockup.tsx",
            "<h1>{props.label}</h1>",
            "<h1>{props.label}</h1><p>{loaded}:{readFileSync('cwd.txt', 'utf8')}</p><output>{fromEnvironment}:{npmRoots}</output><aside>{exclusive()}</aside>",
        );
        consumer.replace(
            "postcss.mjs",
            "new URL(\"./tokens.json\", import.meta.url)",
            "process.cwd() + '/tokens.json'",
        );
        consumer.replace("postcss.mjs", "export default {", "if (process.env.INIT_CWD !== undefined || process.env.npm_package_json !== undefined || process.env.npm_config_local_prefix !== undefined || JSON.parse(readFileSync(process.env.PWD + '/tokens.json','utf8')).color !== tokens.color) throw new Error('PostCSS inherited another source environment');\nexport default {");
    }
    head.replace("specs/screen.mockup.tsx", "\"Hello\"", "\"HeadOnly\"");
    base.replace("specs/screen.mockup.tsx", "\"Hello\"", "\"BaseOnly\"");
    let head_generation = head.generation(head.prepare().unwrap());
    let head_document = head_generation.render("screen/index.mobile.html").unwrap();
    assert!(String::from_utf8_lossy(&head_document.bytes).contains("HeadOnly"));
    assert!(String::from_utf8_lossy(&head_document.bytes).contains("head cwd:head cwd"));
    assert!(String::from_utf8_lossy(&head_document.bytes).contains("head cwd:unset:unset:unset"));
    let head_css = head_generation
        .resource("styles/specs/components/chip.mockup.tsx.css")
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&head_css).contains("var(--head-cwd)"));
    let dependencies = workspace();
    let leased = Arc::new(BaseSide {
        sources: Lease {
            directory: base.root().into(),
            guard: Box::new(Unimock::new(())),
        },
        dependencies: Resolved {
            tier: Tier::Working,
            node_modules: dependencies.join("node_modules"),
            module_resolution: ModuleResolution {
                package_roots: vec![dependencies.to_string_lossy().into_owned()],
                ..Default::default()
            },
            warning: None,
            lease: Some(Lease {
                directory: dependencies.clone(),
                guard: Box::new(Unimock::new(())),
            }),
            repository_roots: vec![head.root().into(), dependencies],
        },
        identity: "base-commit".into(),
    });
    let weak = Arc::downgrade(&leased);
    let runtime = Arc::new(Runtime::new(
        Arc::new(WorkingTree),
        Arc::new(WorkingTree),
        head.runtime.pool.clone(),
        head.runtime.cache.clone(),
        head.runtime.workers.clone(),
        super::support::package_version::read(),
        Some(leased.clone()),
    ));
    assert!(Arc::ptr_eq(&runtime.pool, &head.runtime.pool));
    assert!(Arc::ptr_eq(&runtime.cache, &head.runtime.cache));
    assert!(Arc::ptr_eq(&runtime.workers, &head.runtime.workers));
    let prepared = {
        let builder: &dyn CatalogueBuilder = &Builder {
            tree: Arc::new(WorkingTree),
            discovery: Arc::new(Discoverer {
                tree: Arc::new(WorkingTree),
            }),
            definitions: runtime.clone(),
        };
        builder.prepare(&base.config(), None).unwrap()
    };
    let factory: &dyn GraphFactory = runtime.as_ref();
    let generation = factory
        .create(&base.config())
        .unwrap()
        .prepare(base.config(), prepared, None)
        .unwrap();
    let document = generation.render("screen/index.mobile.html").unwrap();
    let html = String::from_utf8(document.bytes.clone()).unwrap();
    assert!(html.contains("BaseOnly"));
    assert!(!html.contains("HeadOnly"));
    assert!(html.contains("base cwd:base cwd"));
    assert!(!html.contains("head cwd"));
    assert!(html.contains("base cwd:unset:unset:unset"));
    assert!(!html.contains("environment head secret"));
    assert!(html.contains("ENOENT"));
    assert!(!html.contains("head secret"));
    let base_css = generation
        .resource("styles/specs/components/chip.mockup.tsx.css")
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&base_css).contains("var(--base-cwd)"));
    assert!(!String::from_utf8_lossy(&base_css).contains("var(--head-cwd)"));
    let restored_head = head_generation.render("screen/index.desktop.html").unwrap();
    assert!(String::from_utf8_lossy(&restored_head.bytes).contains("head cwd:head cwd"));
    let calls = head.pool.calls.lock().unwrap();
    let Call::Bundle(bundle) = calls
        .iter()
        .find(|call| matches!(call, Call::Bundle(bundle) if bundle.source_root == base.root().to_string_lossy()))
        .unwrap()
    else {
        panic!("bundle")
    };
    assert_eq!(bundle.source_root, base.root().to_string_lossy());
    assert_eq!(bundle.repository_roots[0], head.root().to_string_lossy());
    assert!(
        calls
            .iter()
            .filter_map(|call| match call {
                Call::ProcessCss(css)
                    if css.context.starts_with("base-commit:")
                        || css.source_root == base.root().to_string_lossy() =>
                {
                    Some(css)
                }
                _ => None,
            })
            .all(|css| css.context.starts_with("base-commit:")
                && css.source_root == base.root().to_string_lossy())
    );
    assert!(calls.iter().any(
        |call| matches!(call, Call::ProcessCss(css) if css.context.starts_with("base-commit:"))
    ));
    assert_eq!(head.processes.hellos(), vec![1, 1, 1]);
    assert!(base.processes.hellos().is_empty());
    drop(calls);
    drop(runtime);
    drop(leased);
    assert!(weak.upgrade().is_some());
    drop(generation);
    assert!(weak.upgrade().is_none());
}

fn inherited_head_environment() -> bool {
    if env::var_os("MOKLY_BASE_ENV_CHILD").is_some() {
        return false;
    }
    let directory = tempfile::tempdir().unwrap();
    fs::write(directory.path().join("cwd.txt"), "environment head secret").unwrap();
    fs::write(
        directory.path().join("tokens.json"),
        r#"{"color":"environment-head"}"#,
    )
    .unwrap();
    let module = module_path!().split_once("::").unwrap().1;
    let output = Command::new(env::current_exe().unwrap())
        .args(["--exact", &format!("{module}::base_renders_its_own_sources_and_holds_both_leases_until_the_graph_closes"), "--nocapture"])
        .env("MOKLY_BASE_ENV_CHILD", "1")
        .env("PWD", directory.path())
        .env("INIT_CWD", directory.path())
        .env("npm_package_json", directory.path().join("package.json"))
        .env("npm_config_local_prefix", directory.path())
        .output().unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("1 passed;"));
    true
}
