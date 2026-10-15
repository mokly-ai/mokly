//! Real Node integration through the same pool used by the Rust core.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::error::{Error, FailureKind, ProtocolError};
use mokly_sidecar::methods::{
    Bundle, Call, ColorScheme, CssModules, Generation, IgnoreScope, ModuleResolution, ProcessCss,
    Render, RenderComponent, RenderPage, RenderStory,
};
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;
use serde_json::json;

#[derive(Default)]
struct Reporter(Mutex<Vec<String>>);
impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        self.0.lock().unwrap().push(message.to_owned());
    }
}

fn pool_with_entry(version: &str, entry: &str) -> Pool {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let clock = Arc::new(SystemClock::new());
    let factory = NodeFactory::new(
        Arc::new(SystemProcessGroups),
        clock.clone(),
        Arc::new(Reporter::default()),
        Arc::new(SystemMemory),
    );
    Pool::new(
        Arc::new(factory),
        clock,
        Launch {
            node: "node".into(),
            entry: root.join(entry),
            repository: root,
            version: version.to_owned(),
        },
        PoolOptions {
            size: 2,
            timeout_ms: None,
        },
    )
}

fn pool(version: &str) -> Pool {
    pool_with_entry(version, "packages/mokly/dist/sidecar.js")
}

#[test]
fn bundles_describes_and_renders_component_screen_story_and_page() {
    let pool: Box<dyn SidecarPool> = Box::new(pool(env!("CARGO_PKG_VERSION")));
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/sidecar")
        .canonicalize()
        .unwrap();
    let bundled = pool
        .request(Call::Bundle(Bundle {
            entry_files: vec![
                "component.mockup.tsx".into(),
                "screen.mockup.tsx".into(),
                "page.mockup.ts".into(),
            ],
            renderer: Some("renderer.tsx".into()),
            stories_files: vec!["button.stories.tsx".into()],
            module_resolution: ModuleResolution::default(),
            source_root: root.display().to_string(),
        }))
        .unwrap();
    let MethodResult::Bundle(bundled) = bundled else {
        panic!("expected bundle");
    };
    let generation = bundled.generation;
    pool.request(Call::CssModules(CssModules {
        generation: generation.clone(),
        class_maps: BTreeMap::from([(
            "control.module.css".into(),
            BTreeMap::from([("control".into(), "smoke-control".into())]),
        )]),
    }))
    .unwrap();
    let described = pool
        .request(Call::Describe(Generation {
            generation: generation.clone(),
        }))
        .unwrap();
    let MethodResult::Definitions(described) = described else {
        panic!("expected definitions");
    };
    assert!(described.diagnostics.is_empty());
    assert_eq!(described.screens.len(), 1);
    assert_eq!(described.stories.len(), 1);
    let render = |handle: &str| Render {
        generation: generation.clone(),
        handle: handle.into(),
        props: BTreeMap::from([("label".into(), json!("Smoke"))]),
        viewport: "mobile".into(),
        color_scheme: ColorScheme::Dark,
    };
    for call in [
        Call::RenderComponent(RenderComponent {
            render: render("component.mockup.tsx#control"),
            slots: BTreeMap::from([("children".into(), "token".into())]),
            ignore_scope: IgnoreScope::Enabled,
        }),
        Call::RenderScreen(render("screen.mockup.tsx#screen")),
        Call::RenderStory(RenderStory {
            generation: generation.clone(),
            story_id: "button.stories.tsx#Primary".into(),
            props: BTreeMap::from([("label".into(), json!("Smoke"))]),
            viewport: "desktop".into(),
            color_scheme: ColorScheme::Light,
        }),
    ] {
        let MethodResult::Render(result) = pool.request(call).unwrap() else {
            panic!("expected render");
        };
        assert!(result.html.contains("Smoke"));
        println!("{}", result.html);
    }
    let MethodResult::Page(page) = pool
        .request(Call::RenderPage(RenderPage {
            generation,
            handle: "page.mockup.ts#default".into(),
        }))
        .unwrap()
    else {
        panic!("expected page");
    };
    assert!(page.html.starts_with("<!doctype html>"));
    println!("{}", page.html);
    pool.shutdown().unwrap();
}

#[test]
fn wrong_package_version_fails_before_command_traffic() {
    let pool = pool("wrong-version");
    assert!(matches!(
        pool.request(Call::ProcessCss(ProcessCss {
            postcss: "unused".into(),
            source_path: "unused".into(),
            text: String::new()
        })),
        Err(Error::Version { .. })
    ));
}

#[test]
fn process_crash_retries_once_and_bad_hello_fails_closed() {
    let call = || {
        Call::ProcessCss(ProcessCss {
            postcss: "unused".into(),
            source_path: "unused".into(),
            text: String::new(),
        })
    };
    let crashed = pool_with_entry(
        env!("CARGO_PKG_VERSION"),
        "tests/fixtures/sidecar/crash-peer.mjs",
    );
    assert!(matches!(
        crashed.request(call()),
        Err(Error::RequestCrashed {
            kind: FailureKind::Bundle,
            ..
        })
    ));
    let malformed = pool_with_entry(
        env!("CARGO_PKG_VERSION"),
        "tests/fixtures/sidecar/bad-peer.mjs",
    );
    assert!(matches!(
        malformed.request(call()),
        Err(Error::Protocol(ProtocolError::Handshake))
    ));
    let unavailable = pool_with_entry(env!("CARGO_PKG_VERSION"), "missing-sidecar.js");
    assert!(matches!(
        unavailable.request(call()),
        Err(Error::Unavailable { .. })
    ));
}

#[test]
fn negative_zero_survives_definitions_and_render_requests() {
    let pool = pool(env!("CARGO_PKG_VERSION"));
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/sidecar")
        .canonicalize()
        .unwrap();
    let MethodResult::Bundle(bundled) = pool
        .request(Call::Bundle(Bundle {
            entry_files: vec!["negative-zero.mockup.tsx".into()],
            renderer: None,
            stories_files: Vec::new(),
            module_resolution: ModuleResolution::default(),
            source_root: root.display().to_string(),
        }))
        .unwrap()
    else {
        panic!("expected bundle");
    };
    let generation = bundled.generation;
    pool.request(Call::CssModules(CssModules {
        generation: generation.clone(),
        class_maps: BTreeMap::new(),
    }))
    .unwrap();
    let MethodResult::Definitions(definitions) = pool
        .request(Call::Describe(Generation {
            generation: generation.clone(),
        }))
        .unwrap()
    else {
        panic!("expected definitions");
    };
    assert!(
        definitions.screens[0].props["value"]
            .as_f64()
            .unwrap()
            .is_sign_negative()
    );
    let MethodResult::Render(rendered) = pool
        .request(Call::RenderScreen(Render {
            generation,
            handle: "negative-zero.mockup.tsx#default".into(),
            props: BTreeMap::from([("value".into(), json!(-0.0))]),
            viewport: "mobile".into(),
            color_scheme: ColorScheme::Light,
        }))
        .unwrap()
    else {
        panic!("expected render");
    };
    assert_eq!(rendered.html, "<main>negative</main>");
    pool.shutdown().unwrap();
}
