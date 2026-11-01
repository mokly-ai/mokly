//! Consumer PostCSS runs in an explicit side-specific context, before scoping.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_css::error::{CssError, InternalError};
use mokly_css::resolver::ImportResolver;
use mokly_css::types::{CssProcessor, ProcessedCss};
use mokly_model::material::digest;
use mokly_sidecar::methods::{Call, ProcessCss};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::results::{Css, DependencyKind};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTree;

use crate::dependency_usage::DependencyUsage;
use crate::error::{RenderError, Result};
use crate::leases::ContextLease;
use crate::postcss_cache::{CssCache, CssRecord};
use crate::postcss_read_inventory::ModuleDigests;
use crate::postcss_turns::Turns;
use crate::side::SideInputs;
use crate::{postcss_inventory, postcss_nested, postcss_read_inventory};

pub(crate) struct PostCss {
    pub(crate) usage: Arc<dyn DependencyUsage>,
    pub(crate) lease: Arc<ContextLease>,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) inventory_tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) side: SideInputs,
    pub(crate) module: String,
    pub(crate) cache: Arc<Mutex<CssCache>>,
    pub(crate) resolver: Arc<dyn ImportResolver>,
    /// One sidecar request of this context at a time, held outside the shared cache lock.
    pub(crate) turns: Turns,
    pub(crate) module_digests: ModuleDigests,
}

impl CssProcessor for PostCss {
    fn process(
        &self,
        path: &str,
        source: &str,
        excluded: &BTreeSet<String>,
    ) -> mokly_css::error::Result<ProcessedCss> {
        match self.process_input(path, source, excluded) {
            Ok(processed) => Ok(processed),
            Err(source) => match source.diagnostic() {
                Some(source) => Err(CssError::Runtime { source }),
                None => Err(CssError::Internal(InternalError::Provider {
                    source: Box::new(source),
                })),
            },
        }
    }
}

impl PostCss {
    fn process_input(
        &self,
        path: &str,
        source: &str,
        excluded: &BTreeSet<String>,
    ) -> Result<ProcessedCss> {
        let key = format!("{}:{path}:{}", self.side.context, digest(source.as_bytes()));
        let mut record = match self.cached(&key) {
            Some(record) => record,
            None => self.request(&key, path, source)?,
        };
        postcss_nested::validate(&postcss_nested::Input {
            tree: self.tree.as_ref(),
            sources: self.inventory_tree.as_ref(),
            resolver: self.resolver.as_ref(),
            root: &self.root,
            side: &self.side,
            path,
            source,
            excluded,
            dependencies: &record.result.dependencies,
        })?;
        if let Some(processed) = &record.processed {
            return Ok(processed.clone());
        }
        let inventory = {
            let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
            let inventory = postcss_inventory::collect(
                self.inventory_tree.as_ref(),
                cache.scans.entry(self.side.context.clone()).or_default(),
                &self.root,
                &self.side.source_root,
                path,
                record.result.dependencies.clone(),
            );
            cache.trim();
            inventory?
        };
        let read_evidence = postcss_read_inventory::collect(
            self.tree.as_ref(),
            &self.root,
            &self.side,
            &inventory,
            &record.result.read_evidence,
            &self.module_digests,
        );
        let processed = ProcessedCss {
            read_evidence,
            text: record.result.text.clone(),
            inputs: inventory.inputs,
            plugin_inputs: inventory.plugin_inputs,
            directories: inventory.directories,
        };
        record.processed = Some(processed.clone());
        self.cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(key, record);
        Ok(processed)
    }

    fn cached(&self, key: &str) -> Option<CssRecord> {
        let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
        cache.purge();
        cache.records.get(key).cloned()
    }

    /// Wait for this context's turn, then reuse a result or a failure that arrived meanwhile.
    fn request(&self, key: &str, path: &str, source: &str) -> Result<CssRecord> {
        let mut turn = self.turns.take();
        if let Some(record) = self.cached(key) {
            return Ok(record);
        }
        if let Some(source) = turn.failure(key) {
            return Err(RenderError::Css {
                source: CssError::Runtime { source },
            });
        }
        let result = match self.process_css(path, source) {
            Ok(result) => result,
            Err(error) => {
                if let Some(diagnostic) = error.diagnostic() {
                    turn.fail(key, diagnostic, error.lost_child());
                }
                return Err(error);
            }
        };
        let record = CssRecord {
            result,
            processed: None,
        };
        let cached = record.clone();
        self.cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(key.into(), cached);
        Ok(record)
    }

    #[tracing::instrument(name = "css.postcss", skip_all, err)]
    fn process_css(&self, path: &str, source: &str) -> Result<Css> {
        self.lease.used.store(true, Ordering::Relaxed);
        let call = Call::ProcessCss(ProcessCss {
            repository_roots: self
                .side
                .repository_roots
                .iter()
                .map(|root| root.to_string_lossy().into_owned())
                .collect(),
            context: self.side.context.clone(),
            source_root: self.side.source_root.to_string_lossy().into_owned(),
            module_resolution: self.side.module_resolution.clone(),
            postcss: self.module.clone(),
            source_path: path.into(),
            text: source.into(),
        });
        let result = match self.pool.request(call) {
            Ok(MethodResult::Css(result)) => result,
            Ok(_) => {
                return Err(RenderError::ResultKind {
                    method: "processCss",
                });
            }
            Err(source) => return Err(RenderError::Sidecar { source }),
        };
        for directory in result.unmapped_dependency_directories.iter().flatten() {
            self.usage.unmapped(directory);
        }
        for dependency in &result.dependencies {
            if matches!(dependency.kind, DependencyKind::File)
                && let Some(path) = self.side.logical_dependency(Path::new(&dependency.path))
            {
                self.usage.record(&self.side.dependency_aliases, &path);
            }
        }
        Ok(result)
    }
}

#[cfg(test)]
#[path = "_tests_/postcss_request_tests.rs"]
mod postcss_request_tests;

#[cfg(test)]
#[path = "_tests_/postcss_support.rs"]
mod postcss_support;

#[cfg(test)]
#[path = "_tests_/postcss_lock_tests.rs"]
mod postcss_lock_tests;

#[cfg(test)]
#[path = "_tests_/postcss_failure_tests.rs"]
mod postcss_failure_tests;
