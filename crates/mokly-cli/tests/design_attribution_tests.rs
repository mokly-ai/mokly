//! Steady-state attribution over two registered commits copied from the design catalogue.

use std::env;
use std::path::PathBuf;
use std::process::Command;

use tempfile::TempDir;

#[path = "../src/base_dependencies.rs"]
mod base_dependencies;
#[path = "../src/changes_base.rs"]
mod changes_base;
#[path = "../src/changes_runtime.rs"]
mod changes_runtime;
#[path = "../src/changes_static.rs"]
mod changes_static;
#[expect(dead_code, reason = "the fixture uses only Git helpers")]
mod changes_support;
mod design_support;

#[path = "../src/render_runtime.rs"]
mod render_runtime;
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
