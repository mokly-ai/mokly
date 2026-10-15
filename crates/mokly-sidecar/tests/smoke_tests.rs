//! Real Node integration through the same pool used by the Rust core.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::bindings::{Bindings, EntryBinding, SlotInput};
use mokly_sidecar::methods::{
    Bundle, Call, ColorScheme, CssModules, Generation, IgnoreScope, ModuleResolution, Render,
    RenderComponent, RenderPage, RenderStory,
};
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;
use serde_json::json;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

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
            size: 2.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

fn pool(version: &str) -> Pool {
    pool_with_entry(version, "packages/mokly/dist/sidecar.js")
}

#[test]
fn bundles_describes_and_renders_component_screen_story_and_page() {
    let pool: Box<dyn SidecarPool> = Box::new(pool(&package_version::read()));
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
            module_resolution: ModuleResolution {
                package_roots: vec![
                    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("../..")
                        .display()
                        .to_string(),
                ],
                ..ModuleResolution::default()
            },
            source_root: root.display().to_string(),
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
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
    let bindings =
        described
            .screens
            .iter()
            .chain(&described.components)
            .chain(&described.pages)
            .map(|definition| {
                (
                    definition.handle.clone(),
                    EntryBinding {
                        path: definition.metadata.path.clone().unwrap_or_else(|| {
                            definition.handle.split('.').next().unwrap().to_owned()
                        }),
                        title: definition.metadata.title.clone().unwrap_or_default(),
                    },
                )
            })
            .collect::<BTreeMap<_, _>>();
    pool.request(Call::Bindings(Bindings {
        generation: generation.clone(),
        entries: bindings.clone(),
    }))
    .unwrap();
    let render = |handle: &str| Render {
        generation: generation.clone(),
        handle: handle.into(),
        entry: bindings[handle].clone(),
        props: BTreeMap::from([("label".into(), json!("Smoke"))]),
        viewport: "mobile".into(),
        color_scheme: ColorScheme::Dark,
    };
    for (index, call) in [
        Call::RenderComponent(RenderComponent {
            render: render("component.mockup.tsx#control"),
            slots: BTreeMap::from([(
                "children".into(),
                SlotInput::Placeholder {
                    token: "token".into(),
                },
            )]),
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
    ]
    .into_iter()
    .enumerate()
    {
        let MethodResult::Render(result) = pool.request(call).unwrap() else {
            panic!("expected render");
        };
        insta::assert_snapshot!(format!("smoke_{index}"), result.html);
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
    insta::assert_snapshot!("smoke_page", page.html);
    println!("{}", page.html);
    pool.shutdown().unwrap();
}

mod smoke;
