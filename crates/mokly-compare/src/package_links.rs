//! Small package overlays whose links always resolve into the base extraction.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use crate::error::{Error, IoResult, Result};
use crate::storage_tree::validate_directory;

pub(crate) fn write(
    root: &Path,
    destination: &Path,
    source: &Path,
    packages: &BTreeMap<String, String>,
) -> Result<()> {
    validate_directory(root, source)?;
    let source = fs::canonicalize(source).base()?;
    fs::create_dir(destination.join("node_modules")).base()?;
    for (name, directory) in packages {
        let target = fs::canonicalize(source.join(directory)).base()?;
        if !target.starts_with(&source) {
            return Err(Error::LocalOutside {
                path: directory.clone(),
            });
        }
        let path = destination.join("node_modules").join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).base()?;
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, path).base()?;
        #[cfg(windows)]
        junction::create(&target, path).base()?;
    }
    Ok(())
}
