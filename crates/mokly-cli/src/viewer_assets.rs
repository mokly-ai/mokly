//! Locate the matching package browser inventory at the CLI composition root.

use std::env;
use std::path::PathBuf;

pub(super) fn dist() -> Option<PathBuf> {
    if let Some(path) = env::var_os("MOKLY_VIEWER_DIST") {
        return Some(PathBuf::from(path));
    }
    let executable = env::current_exe().ok()?;
    executable
        .ancestors()
        .skip(1)
        .flat_map(|parent| {
            [
                parent.join("viewer/dist"),
                parent.join("packages/viewer/dist"),
            ]
        })
        .find(|path| path.join("browser.manifest.json").is_file())
}
