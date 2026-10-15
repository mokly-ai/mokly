//! Negative zero crosses the real NDJSON channel without losing its sign.

use std::collections::BTreeMap;
use std::path::PathBuf;

use mokly_sidecar::bindings::{Bindings, EntryBinding};
use mokly_sidecar::methods::{
    Bundle, Call, ColorScheme, CssModules, Generation, ModuleResolution, Render,
};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;
use serde_json::json;

use super::super::pool;

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
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
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
    pool.request(Call::Bindings(Bindings {
        generation: generation.clone(),
        entries: BTreeMap::from([(
            "negative-zero.mockup.tsx#default".into(),
            EntryBinding {
                path: "zero".into(),
                title: "Zero".into(),
            },
        )]),
    }))
    .unwrap();
    let MethodResult::Render(rendered) = pool
        .request(Call::RenderScreen(Render {
            generation,
            handle: "negative-zero.mockup.tsx#default".into(),
            entry: EntryBinding {
                path: "zero".into(),
                title: "Zero".into(),
            },
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
