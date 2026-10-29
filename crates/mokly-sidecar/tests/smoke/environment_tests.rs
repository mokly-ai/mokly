//! Sidecar child processes receive a filtered environment.

use std::collections::BTreeMap;
use std::env;
use std::process::Command;

use mokly_sidecar::bindings::{Bindings, EntryBinding};
use mokly_sidecar::methods::{
    Bundle, Call, ColorScheme, CssModules, IgnoreScope, ModuleResolution, ProcessCss, Render,
    RenderComponent,
};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;

use super::super::pool;

const CHILD_MARKER: &str = "MOKLY_ENVIRONMENT_PROBE";

#[test]
fn inherited_mokly_environment_is_hidden_from_sidecar_children() {
    let executable = env::current_exe().unwrap();
    let output = Command::new(executable)
        .arg("--exact")
        .arg("smoke::environment_tests::child_checks_environment")
        .arg("--nocapture")
        .env("MOKLY_TOKEN", "probe-token-180")
        .env("MOKLY_ENDPOINT", "https://probe.invalid/plan")
        .env("MOKLY_POSTCSS_PHASES", "0")
        .env("FIXTURE_ENVIRONMENT_VALUE", "kept")
        .env(CHILD_MARKER, "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "child process failed: {}\nstderr: {}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("1 passed"),
        "child test did not run exactly one test:\n{stdout}"
    );
}

#[test]
fn child_checks_environment() {
    if env::var_os(CHILD_MARKER).is_none() {
        return;
    }

    let fixture_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/sidecar/environment")
        .canonicalize()
        .unwrap();
    let repository = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let sidecars: Box<dyn SidecarPool> = Box::new(pool(&super::super::package_version::read()));
    let MethodResult::Bundle(bundle) = sidecars
        .request(Call::Bundle(Bundle {
            evaluation: None,
            entry_files: vec!["component.mockup.tsx".into()],
            renderer: Some("renderer.tsx".into()),
            stories_files: Vec::new(),
            module_resolution: ModuleResolution {
                package_roots: vec![repository.display().to_string()],
                ..ModuleResolution::default()
            },
            source_root: fixture_root.display().to_string(),
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
        }))
        .unwrap()
    else {
        panic!("expected bundle");
    };
    let generation = bundle.generation;
    sidecars
        .request(Call::CssModules(CssModules {
            generation: generation.clone(),
            class_maps: BTreeMap::new(),
        }))
        .unwrap();
    let MethodResult::Definitions(definitions) = sidecars
        .request(Call::Describe(mokly_sidecar::methods::Generation {
            generation: generation.clone(),
        }))
        .unwrap()
    else {
        panic!("expected definitions");
    };
    let handle = definitions.components[0].handle.clone();
    let binding = EntryBinding {
        path: "components/environment".into(),
        title: "Environment".into(),
    };
    sidecars
        .request(Call::Bindings(Bindings {
            generation: generation.clone(),
            entries: BTreeMap::from([(handle.clone(), binding.clone())]),
        }))
        .unwrap();
    let MethodResult::Render(rendered) = sidecars
        .request(Call::RenderComponent(RenderComponent {
            render: Render {
                generation: generation.clone(),
                handle,
                entry: binding,
                props: BTreeMap::new(),
                viewport: "mobile".into(),
                color_scheme: ColorScheme::Light,
            },
            slots: BTreeMap::new(),
            ignore_scope: IgnoreScope::Enabled,
        }))
        .unwrap()
    else {
        panic!("expected render");
    };
    assert!(!rendered.html.contains("probe-token-180"));
    assert!(!rendered.html.contains("probe.invalid"));
    assert_eq!(rendered.html.matches("__mokly_env_absent__").count(), 4);
    assert_eq!(rendered.html.matches("data-fixture=\"kept\"").count(), 2);

    let MethodResult::Css(css) = sidecars
        .request(Call::ProcessCss(ProcessCss {
            repository_roots: Vec::new(),
            context: "environment".into(),
            source_root: fixture_root.display().to_string(),
            module_resolution: ModuleResolution {
                package_roots: vec![repository.display().to_string()],
                ..ModuleResolution::default()
            },
            postcss: "postcss.mjs".into(),
            source_path: "input.css".into(),
            text: ".input {}".into(),
        }))
        .unwrap()
    else {
        panic!("expected CSS");
    };
    assert!(!css.text.contains("probe-token-180"));
    assert!(!css.text.contains("probe.invalid"));
    assert!(css.text.contains("token: __mokly_env_absent__"));
    assert!(css.text.contains("endpoint: __mokly_env_absent__"));
    assert!(css.text.contains("phases: 1"));
    assert!(css.text.contains("fixture: kept"));
    sidecars.shutdown().unwrap();
}
