//! Base-side projection hints name the repository path that each projection asks for first.

use std::path::PathBuf;

use crate::source_paths;
use crate::sources::SideTree;

impl SideTree {
    /// Hint, for each logical path, the first repository path that `source` projects.
    /// A later alias candidate stays out, because `source` asks for it only when the
    /// first candidate is missing. The head side reads no base, so it hints nothing.
    pub(crate) fn hint_sources(&self, paths: &[PathBuf]) {
        if self._base.is_none() {
            return;
        }
        let first = |path: &PathBuf| {
            if let Some(source) = source_paths::repository_input(&self.root, path) {
                return Some(source);
            }
            let relative = path.strip_prefix(&self.root).ok()?;
            let relative = relative.to_string_lossy().replace('\\', "/");
            let candidate = source_paths::source_candidates(&self.aliases, &relative)
                .into_iter()
                .next()?;
            Some(self.root.join(candidate))
        };
        let sources: Vec<_> = paths.iter().filter_map(first).collect();
        self.sources.hint_projections(&sources);
    }
}
