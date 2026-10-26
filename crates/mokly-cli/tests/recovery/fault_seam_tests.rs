//! The test fault module disappears from release builds.

use std::fs;
use std::process::Command;

use mokly_test_support::workspace;

#[test]
fn the_fault_module_erases_itself_without_debug_assertions() {
    let root = tempfile::tempdir().unwrap();
    let module = workspace::root().join("crates/mokly-cli/src/test_faults/mod.rs");
    let source = root.path().join("probe.rs");
    let binary = root
        .path()
        .join(if cfg!(windows) { "probe.exe" } else { "probe" });
    let prefix = format!("#[path = {:?}] mod faults;\n", module.display().to_string());
    let compile = || {
        Command::new("rustc")
            .args(["--edition=2024", "-C", "debug-assertions=no"])
            .arg(&source)
            .arg("-o")
            .arg(&binary)
            .output()
            .unwrap()
    };
    fs::write(
        &source,
        format!("{prefix}fn main() {{ assert!(!cfg!(debug_assertions)); }}"),
    )
    .unwrap();
    let compiled = compile();
    assert!(
        compiled.status.success(),
        "{}",
        String::from_utf8_lossy(&compiled.stderr)
    );
    fs::write(
        &source,
        format!("{prefix}fn main() {{ let _ = faults::files; }}"),
    )
    .unwrap();
    let rejected = compile();
    let message = String::from_utf8_lossy(&rejected.stderr);
    assert!(!rejected.status.success());
    assert!(
        message.contains("E0433") && message.contains("faults"),
        "{message}"
    );
}
