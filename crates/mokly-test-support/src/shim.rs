//! Install the `@mokly/mokly` shim with a native package that links to a test binary.

use std::fs;
use std::path::{Path, PathBuf};

use crate::files::link_directory;
use crate::workspace;

/// The shim files that an installed `@mokly/mokly` package needs.
const SHIM_FILES: [&str; 7] = [
    "package.json",
    "bin/mokly.mjs",
    "dist/runtime.mjs",
    "dist/shim.mjs",
    "dist/platform.mjs",
    "dist/version.mjs",
    "dist/execution.mjs",
];

/// Install `@mokly/mokly` and every native package below `root/installation`.
///
/// Each native package runs `binary`. Returns the installed `bin/mokly.mjs`.
#[cfg(unix)]
pub fn install(root: &Path, binary: &Path) -> PathBuf {
    let checkout = workspace::root();
    let scope = root.join("installation/node_modules/@mokly");
    fs::create_dir_all(&scope).unwrap();
    link_directory(&checkout.join("packages/viewer"), &scope.join("viewer"));
    let package = scope.join("mokly");
    fs::create_dir_all(package.join("bin")).unwrap();
    fs::create_dir(package.join("dist")).unwrap();
    for file in SHIM_FILES {
        fs::copy(
            checkout.join("packages/mokly").join(file),
            package.join(file),
        )
        .unwrap();
    }
    std::os::unix::fs::symlink(
        checkout.join("packages/mokly/dist/sidecar.js"),
        package.join("dist/sidecar.js"),
    )
    .unwrap();
    for entry in fs::read_dir(checkout.join("packages")).unwrap() {
        let entry = entry.unwrap();
        if !entry.file_name().to_string_lossy().starts_with("native-") {
            continue;
        }
        let native = scope.join(entry.file_name());
        fs::create_dir_all(native.join("bin")).unwrap();
        fs::copy(
            entry.path().join("package.json"),
            native.join("package.json"),
        )
        .unwrap();
        std::os::unix::fs::symlink(binary, native.join("bin/mokly")).unwrap();
    }
    package.join("bin/mokly.mjs")
}
