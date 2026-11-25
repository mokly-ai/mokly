//! Steady-state attribution over two registered commits copied from the design catalogue.

use std::env;
use std::path::PathBuf;
use std::process::Command;

use tempfile::TempDir;

#[path = "../src/base_dependencies.rs"]
mod base_dependencies;
#[path = "../src/base_dependency_selection.rs"]
mod base_dependency_selection;
#[path = "../src/base_dependency_sources.rs"]
mod base_dependency_sources;
#[path = "../src/base_render_admission.rs"]
mod base_render_admission;
#[path = "../src/changes_base.rs"]
mod changes_base;
#[path = "../src/changes_base_sources.rs"]
mod changes_base_sources;
#[path = "../src/changes_freshness.rs"]
mod changes_freshness;
#[path = "../src/changes_runtime.rs"]
mod changes_runtime;
#[path = "../src/changes_source_admission.rs"]
mod changes_source_admission;
#[path = "../src/changes_static.rs"]
mod changes_static;
#[expect(dead_code, reason = "the fixture uses only helpers that write sources")]
mod changes_support;
#[path = "../src/changes_validation_admission.rs"]
#[expect(dead_code, reason = "this matrix uses only static preparation")]
mod changes_validation_admission;
#[path = "../src/_tests_/dependency_source_support.rs"]
mod dependency_source_support;
mod design_support;

#[path = "../src/bundle_runtime.rs"]
mod bundle_runtime;
#[path = "../src/render_runtime.rs"]
mod render_runtime;
#[path = "../src/serve_eager_diagnostics.rs"]
#[expect(dead_code, reason = "this matrix creates no eager Serve task")]
mod serve_eager_diagnostics;
#[path = "../src/serve_eager_events.rs"]
#[expect(dead_code, reason = "this matrix creates no eager Serve task")]
mod serve_eager_events;
#[path = "../src/terminal.rs"]
#[expect(dead_code, reason = "native fixtures use no terminal streams")]
mod terminal;

#[test]
fn design_catalogue_attribution_acceptance_matrix() {
    let name = "design_catalogue_attribution_acceptance_matrix";
    if let Some(root) = env::var_os("MOKLY_TEST_DESIGN_ROOT") {
        let root = PathBuf::from(root);
        design_support::run(&root);
        println!("Design fixture complete");
        return;
    }
    let fixture = design_support::fixture();
    let cache = TempDir::new().unwrap();
    let output = Command::new(env::current_exe().unwrap())
        .args(["--exact", name, "--nocapture"])
        .env("MOKLY_TEST_DESIGN_ROOT", fixture.path())
        .env("XDG_CACHE_HOME", cache.path())
        .env("LOCALAPPDATA", cache.path())
        .env("TMPDIR", cache.path())
        .env("TMP", cache.path())
        .env("TEMP", cache.path())
        .env(
            "MOKLY_PACKAGE_ROOT",
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("MOKLY_SIDECARS")
        .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("Design fixture complete"));
    println!("{}", String::from_utf8_lossy(&output.stdout));
}
