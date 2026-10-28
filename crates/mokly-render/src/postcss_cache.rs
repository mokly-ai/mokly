//! A byte-accounted cache shares generation scans and bounded processor results.

use std::collections::BTreeMap;
use std::sync::mpsc::{self, Receiver, Sender};

use mokly_css::types::ProcessedCss;
use mokly_sidecar::results::Css;

use crate::postcss_scan::Scan;

#[derive(Clone)]
pub(crate) struct CssRecord {
    pub(crate) result: Css,
    pub(crate) processed: Option<ProcessedCss>,
}

pub(crate) struct CssCache {
    pub(crate) releases: Sender<String>,
    pub(crate) released: Receiver<String>,
    pub(crate) records: BTreeMap<String, CssRecord>,
    pub(crate) scans: BTreeMap<String, Scan>,
    pub(crate) limit: usize,
    /// Running charge of `records`, so a change costs one record's size, not the whole cache.
    pub(crate) record_bytes: usize,
}

impl Default for CssCache {
    fn default() -> Self {
        let (releases, released) = mpsc::channel();
        Self {
            releases,
            released,
            records: BTreeMap::new(),
            scans: BTreeMap::new(),
            limit: 64 * 1024 * 1024,
            record_bytes: 0,
        }
    }
}

impl CssCache {
    pub(crate) fn purge(&mut self) {
        for id in self.released.try_iter() {
            self.scans.remove(&id);
            let prefix = format!("{id}:");
            let mut removed = 0;
            self.records.retain(|key, record| {
                let keep = !key.starts_with(&prefix);
                if !keep {
                    removed += key.capacity() + record.retained_bytes();
                }
                keep
            });
            self.record_bytes = self.record_bytes.saturating_sub(removed);
        }
    }

    pub(crate) fn trim(&mut self) {
        self.purge();
        if self.retained_bytes() > self.limit {
            self.clear();
        }
    }

    pub(crate) fn insert(&mut self, key: String, record: CssRecord) {
        self.purge();
        if let Some((previous, replaced)) = self.records.remove_entry(&key) {
            self.record_bytes = self
                .record_bytes
                .saturating_sub(previous.capacity() + replaced.retained_bytes());
        }
        let size = key.capacity() + record.retained_bytes();
        if self.retained_bytes() + size > self.limit {
            self.clear();
        }
        if size <= self.limit {
            self.records.insert(key, record);
            self.record_bytes += size;
        }
        tracing::trace!(
            retained_bytes = self.retained_bytes(),
            limit = self.limit,
            "PostCSS cache retention"
        );
    }

    pub(crate) fn retained_bytes(&self) -> usize {
        self.record_bytes
            + self
                .scans
                .iter()
                .map(|(key, scan)| key.capacity() + scan.retained_bytes())
                .sum::<usize>()
    }

    fn clear(&mut self) {
        self.records.clear();
        self.scans.clear();
        self.record_bytes = 0;
    }
}

impl CssRecord {
    fn retained_bytes(&self) -> usize {
        let result = self.result.read_evidence.retained_bytes()
            + self
                .result
                .unmapped_dependency_directories
                .as_ref()
                .map_or(0, |directories| {
                    directories.capacity() * size_of::<String>()
                        + directories.iter().map(String::capacity).sum::<usize>()
                })
            + self.result.text.capacity()
            + self.result.dependencies.capacity() * size_of::<mokly_sidecar::results::Dependency>()
            + self
                .result
                .dependencies
                .iter()
                .map(|value| {
                    value.path.capacity()
                        + value.plugin.as_ref().map_or(0, String::capacity)
                        + value.glob.as_ref().map_or(0, String::capacity)
                })
                .sum::<usize>();
        let processed = self.processed.as_ref().map_or(0, |value| {
            value.read_evidence.retained_bytes()
                + value.text.capacity()
                + value
                    .inputs
                    .iter()
                    .map(|(path, digest)| {
                        path.capacity() + digest.capacity() + size_of::<(String, String)>()
                    })
                    .sum::<usize>()
                + value
                    .plugin_inputs
                    .iter()
                    .map(|(path, origin)| {
                        path.capacity()
                            + origin.plugin.capacity()
                            + origin.stylesheet.capacity()
                            + size_of::<(String, mokly_css::dependencies::PluginInput)>()
                    })
                    .sum::<usize>()
                + value.directories.capacity()
                    * size_of::<mokly_css::dependencies::DirectoryDependency>()
                + value
                    .directories
                    .iter()
                    .map(|directory| {
                        directory.path.capacity()
                            + directory.glob.capacity()
                            + directory.origin.plugin.capacity()
                            + directory.origin.stylesheet.capacity()
                    })
                    .sum::<usize>()
        });
        size_of::<Self>() + result + processed
    }
}

#[cfg(test)]
#[path = "_tests_/postcss_cache_charge_tests.rs"]
mod postcss_cache_charge_tests;
