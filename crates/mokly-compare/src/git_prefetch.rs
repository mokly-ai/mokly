//! Batched known-path reads preserve the Git tree's bounded source cache.

use std::path::PathBuf;

use mokly_git::tree::Limits;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::SourceTree;

use crate::git_tree::GitTree;

impl GitTree {
    pub(crate) fn prefetch_sources(&self, requested: &[PathBuf]) -> Result<()> {
        let paths: Vec<_> = requested
            .iter()
            .map(|path| self.relative(path))
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .flatten()
            .collect();
        if let Err(source) = self.sources.ensure(&paths) {
            return Err(self.failed("prefetch", &self.root, source));
        }
        let index = self.index(&self.root)?;
        let mut batches = Vec::new();
        let mut paths = Vec::new();
        let mut total = 0usize;
        for path in requested {
            let Some(relative) = self.relative(path)? else {
                continue;
            };
            let Some(entry) = index
                .entries
                .get(&relative)
                .filter(|entry| entry.mode.regular())
            else {
                continue;
            };
            if self
                .cache
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .contains(&relative)
            {
                continue;
            }
            let cost = entry
                .size
                .saturating_add(relative.as_str().len())
                .saturating_add(128);
            if cost > self.bound.min(48 * 1024 * 1024) {
                continue;
            }
            if paths.len() == 4096 || total.saturating_add(cost) > self.bound.min(48 * 1024 * 1024)
            {
                batches.push(std::mem::take(&mut paths));
                total = 0;
            }
            total += cost;
            paths.push(relative);
        }
        if !paths.is_empty() {
            batches.push(paths);
        }
        for paths in batches {
            let bytes = match self.sources.read_many(&paths, Limits::default()) {
                Ok(bytes) => bytes,
                Err(
                    source @ crate::error::Error::Git {
                        source: mokly_git::error::Error::Conversion { .. },
                    },
                ) => {
                    let _ = source;
                    for path in paths {
                        let absolute = self.root.join(path.as_str());
                        match self.read(&absolute) {
                            Ok(_) | Err(SourceError::Unavailable { .. }) => {}
                            Err(error) => return Err(error),
                        }
                    }
                    continue;
                }
                Err(source) => return Err(self.failed("prefetch", &self.root, source)),
            };
            let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
            for (path, bytes) in paths.into_iter().zip(bytes) {
                cache.insert(path, bytes);
            }
        }
        Ok(())
    }
}
