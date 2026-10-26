//! The binary under test, callback consumers, and a wrapped sidecar package.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::consumer;
use mokly_test_support::files::write;
use mokly_test_support::process::Mokly;
use mokly_test_support::workspace;
use serde_json::json;
use tempfile::TempDir;

/// The entry module of every callback consumer.
pub(super) const CALLBACK_ENTRY: &str = "specs/callbacks.mockup.tsx";

/// The imports and metadata that start every callback entry.
pub(super) const CALLBACK_PRELUDE: &str = "
import React from 'react';
import {defineComponent, defineScreen, definePage} from '@mokly/mokly';
const metadata = {title:'Callback',description:'Callback fixture',relatedDocs:[]};
";

/// The `mokly` binary of this crate.
pub(super) fn mokly() -> Mokly {
    Mokly::new(env!("CARGO_BIN_EXE_mokly"))
}

/// The absolute path of the Node that runs the tests.
pub(super) fn node() -> String {
    let output = std::process::Command::new("node")
        .args(["-p", "process.execPath"])
        .output()
        .unwrap();
    String::from_utf8(output.stdout).unwrap().trim().to_owned()
}

/// A consumer with light and dark schemes, the callback entry `source`, and `files`.
pub(super) fn callback_consumer(source: &str, files: &[(&str, &str)]) -> TempDir {
    let entry = format!("{CALLBACK_PRELUDE}{source}");
    let mut all = vec![
        ("mokly.config.json", r#"{"colorSchemes":["light","dark"]}"#),
        (CALLBACK_ENTRY, entry.as_str()),
    ];
    all.extend_from_slice(files);
    consumer::project(&all)
}

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
