//! A byte-accounted cache shares generation scans and bounded processor results.

use std::collections::BTreeMap;

use mokly_css::types::ProcessedCss;
use mokly_sidecar::results::Css;

use crate::postcss_scan::Scan;

#[derive(Clone)]
pub(crate) struct CssRecord {
    pub(crate) result: Css,
    pub(crate) processed: Option<ProcessedCss>,
}

pub(crate) struct CssCache {
    pub(crate) records: BTreeMap<String, CssRecord>,
    pub(crate) scans: BTreeMap<String, Scan>,
    pub(crate) limit: usize,
}

impl Default for CssCache {
    fn default() -> Self {
        Self {
            records: BTreeMap::new(),
            scans: BTreeMap::new(),
            limit: 64 * 1024 * 1024,
        }
    }
}

impl CssCache {
    pub(crate) fn trim(&mut self) {
        if self.retained_bytes() > self.limit {
            self.records.clear();
            self.scans.clear();
        }
    }

    pub(crate) fn insert(&mut self, key: String, record: CssRecord) {
        self.records.insert(key.clone(), record.clone());
        if self.retained_bytes() > self.limit {
            self.records.clear();
            self.scans.clear();
            if key.capacity() + record.retained_bytes() <= self.limit {
                self.records.insert(key, record);
            }
        }
        tracing::trace!(
            retained_bytes = self.retained_bytes(),
            limit = self.limit,
            "PostCSS cache retention"
        );
    }

    pub(crate) fn retained_bytes(&self) -> usize {
        self.records
            .iter()
            .map(|(key, record)| key.capacity() + record.retained_bytes())
            .sum::<usize>()
            + self
                .scans
                .iter()
                .map(|(key, scan)| key.capacity() + scan.retained_bytes())
                .sum::<usize>()
    }
}

impl CssRecord {
    fn retained_bytes(&self) -> usize {
        let result = self.result.text.capacity()
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
            value.text.capacity()
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
