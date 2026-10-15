//! Consumer PostCSS runs in an explicit side-specific context, before scoping.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::relative;
use mokly_css::error::{CssError, InternalError};
use mokly_css::resolver::ImportResolver;
use mokly_css::types::{CssProcessor, ProcessedCss};
use mokly_model::material::digest;
use mokly_sidecar::methods::{Call, ProcessCss};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTree;

use crate::error::{RenderError, Result};
use crate::side::SideInputs;
use crate::{postcss_inventory, postcss_nested};

#[derive(Clone)]
pub(crate) struct CssRecord {
    result: Css,
    processed: Option<ProcessedCss>,
}

pub(crate) struct PostCss {
    pub(crate) pool: Arc<dyn SidecarPool>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) root: PathBuf,
    pub(crate) side: SideInputs,
    pub(crate) module: PathBuf,
    pub(crate) cache: Arc<Mutex<BTreeMap<String, CssRecord>>>,
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
            Err(source) => Err(CssError::Internal(InternalError::Provider {
                source: Box::new(source),
            })),
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
        if !cache.contains_key(&key) {
            let result = self.process_css(path, source)?;
            if cache
                .values()
                .map(|entry| entry.result.text.len())
                .sum::<usize>()
                > 64 * 1024 * 1024
            {
                cache.clear();
            }
            cache.insert(
                key.clone(),
                CssRecord {
                    result,
                    processed: None,
                },
            );
        }
        let Some(record) = cache.get_mut(&key) else {
            return Err(RenderError::ResultKind {
                method: "processCss cache",
            });
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
            self.tree.as_ref(),
            &self.root,
            &self.side.source_root,
            path,
            record.result.dependencies.clone(),
        )?;
        let processed = ProcessedCss {
            text: record.result.text.clone(),
            inputs: inventory.inputs,
            plugin_inputs: inventory.plugin_inputs,
            directories: inventory.directories,
        };
        record.processed = Some(processed.clone());
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
            source_path: self
                .side
                .physical_source(path)
                .to_string_lossy()
                .into_owned(),
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
        Ok(result)
    }
}
