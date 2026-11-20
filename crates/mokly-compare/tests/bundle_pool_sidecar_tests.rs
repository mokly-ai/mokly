//! The bundle-pool observation wrapper requires its capture exports before startup.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

const WRAPPER: &str = "tests/support/bundle_pool_sidecar.mjs";
const STARTUP: &str = "mokly-test-bundle-pool-sidecar-started";

fn run_wrapper(missing: Option<&str>) -> Output {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path();
    let wrapper = root.join("crates/mokly-compare").join(WRAPPER);
    let dist = root.join("packages/mokly/dist");
    fs::create_dir_all(wrapper.parent().unwrap()).unwrap();
    fs::create_dir_all(dist.join("sidecar")).unwrap();
    fs::copy(
        Path::new(env!("CARGO_MANIFEST_DIR")).join(WRAPPER),
        &wrapper,
    )
    .unwrap();
    fs::write(root.join("package.json"), r#"{"type":"module"}"#).unwrap();
    fs::write(
        dist.join("sidecar.js"),
        format!("process.stdout.write('{STARTUP}');\n"),
    )
    .unwrap();
    for (file, export, present, absent) in [
        (
            "capture-durability.js",
            "CaptureDurability",
            "export class CaptureDurability {}\n",
            "",
        ),
        (
            "capture-runtime.js",
            "captureRuntime",
            "export const captureRuntime = {};\nexport function mature() {}\n",
            "export function mature() {}\n",
        ),
        (
            "capture-volumes.js",
            "CaptureVolumes",
            "export class CaptureVolumes {}\n",
            "",
        ),
    ] {
        fs::write(
            dist.join("sidecar").join(file),
            if missing == Some(export) {
                absent
            } else {
                present
            },
        )
        .unwrap();
    }
    Command::new("node")
        .arg(wrapper)
        .current_dir(root)
        .env_remove("NODE_OPTIONS")
        .env_remove("NODE_PATH")
        .output()
        .unwrap()
}

#[test]
fn missing_capture_exports_stop_the_observation_wrapper_before_sidecar_startup() {
    let ready = run_wrapper(None);
    assert!(
        ready.status.success(),
        "complete capture exports must permit startup: {ready:?}"
    );
    assert_eq!(String::from_utf8(ready.stdout).unwrap(), STARTUP);
    assert_eq!(String::from_utf8(ready.stderr).unwrap(), "");

    for export in ["CaptureDurability", "captureRuntime", "CaptureVolumes"] {
        let output = run_wrapper(Some(export));
        let stdout = String::from_utf8(output.stdout).unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        assert!(
            !output.status.success(),
            "missing {export} must stop before sidecar startup\nstatus: {}\nstdout: {stdout:?}\nstderr: {stderr:?}",
            output.status
        );
        assert!(
            stderr.contains(export),
            "stderr must name missing {export}: {stderr}"
        );
        assert!(
            !stdout.contains(STARTUP) && !stderr.contains(STARTUP),
            "missing {export} started the sidecar\nstdout: {stdout:?}\nstderr: {stderr:?}"
        );
    }
}
