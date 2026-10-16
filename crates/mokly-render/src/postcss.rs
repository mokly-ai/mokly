//! Consumer PostCSS runs in an explicit side-specific context, before scoping.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::relative;
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
use crate::postcss_cache::{CssCache, CssRecord};
use crate::side::SideInputs;
use crate::{postcss_inventory, postcss_nested};

pub(crate) struct PostCss {
    pub(crate) usage: Arc<dyn DependencyUsage>,
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) inventory_tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) side: SideInputs,
    pub(crate) module: PathBuf,
    pub(crate) cache: Arc<Mutex<CssCache>>,
    pub(crate) resolver: Arc<dyn ImportResolver>,
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
        let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
        let mut record = match cache.records.get(&key) {
            Some(record) => record.clone(),
            None => CssRecord {
                result: self.process_css(path, source)?,
                processed: None,
            },
        };
        postcss_nested::validate(&postcss_nested::Input {
            tree: self.tree.as_ref(),
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
        let inventory = postcss_inventory::collect(
            self.inventory_tree.as_ref(),
            cache.scans.entry(self.side.context.clone()).or_default(),
            &self.root,
            &self.side.source_root,
            path,
            record.result.dependencies.clone(),
        );
        cache.trim();
        let inventory = inventory?;
        let processed = ProcessedCss {
            text: record.result.text.clone(),
            inputs: inventory.inputs,
            plugin_inputs: inventory.plugin_inputs,
            directories: inventory.directories,
        };
        record.processed = Some(processed.clone());
        cache.insert(key, record);
        Ok(processed)
    }

    fn process_css(&self, path: &str, source: &str) -> Result<Css> {
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
            postcss: relative(&self.module, &self.root),
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
