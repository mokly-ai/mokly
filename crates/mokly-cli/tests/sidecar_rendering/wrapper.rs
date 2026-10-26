//! A package root whose sidecar runs a test wrapper before the real sidecar (Unix).

#![cfg(unix)]

use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::files::write;
use mokly_test_support::workspace;
use serde_json::json;

/// Turns a module of the built sidecar into a quoted `file:` URL.
pub(super) type ModuleUrl<'a> = &'a dyn Fn(&str) -> String;

/// A package root whose `dist/sidecar.js` runs `wrapper` before it imports the real sidecar.
///
/// `wrapper` can import the sidecar's own modules through `module(name)` URLs.
pub(super) fn wrapped_sidecar(root: &Path, wrapper: &dyn Fn(ModuleUrl) -> String) -> PathBuf {
    let package = root.join(".context/package");
    write(&package, "package.json", r#"{"type":"module"}"#);
    let dist = workspace::root().join("packages/mokly/dist");
    let module = |name: &str| json!(format!("file://{}", dist.join(name).display())).to_string();
    let mut source = wrapper(&module);
    source.push_str(&format!("\nawait import({});\n", module("sidecar.js")));
    write(&package, "dist/sidecar.js", source);
    fs::canonicalize(package).unwrap()
}
