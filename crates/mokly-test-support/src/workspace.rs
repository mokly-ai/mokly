//! Paths inside the repository checkout that the tests run from.

use std::path::{Path, PathBuf};

/// The repository root, two folders above this crate.
pub fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("the crate lives two folders below the repository root")
        .to_path_buf()
}

/// The `@mokly/mokly` package that the binary loads the sidecar from.
pub fn package_root() -> PathBuf {
    root().join("packages/mokly")
}

/// The built viewer bundle that the binary copies into its output.
pub fn viewer_dist() -> PathBuf {
    root().join("packages/viewer/dist")
}
