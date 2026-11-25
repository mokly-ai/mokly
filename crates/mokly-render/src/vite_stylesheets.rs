//! Run native stylesheet transforms with the render side's selected installation.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::error::{CssError, InternalError, Result};
use mokly_css::vite::{Stylesheet, Transform};
use mokly_sidecar::methods::{Bundle, Call};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::vite_css::TransformViteCss;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTree;

use crate::bundle_inputs;
use crate::dependency_usage::DependencyUsage;
use crate::error::RenderError;
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::vite_base_env::WorkingEnvInputs;

pub(crate) struct ViteStylesheets {
    pool: Arc<dyn SidecarPool>,
    usage: Arc<dyn DependencyUsage>,
    root: PathBuf,
    tree: Arc<dyn SourceTree>,
    side: SideInputs,
    setup: Bundle,
    working_env: Option<Arc<WorkingEnvInputs>>,
    transformed: Mutex<BTreeMap<String, Arc<Stylesheet>>>,
}

impl ViteStylesheets {
    pub(crate) fn new(runtime: &Runtime, config: &ResolvedConfig, side: &SideInputs) -> Self {
        Self {
            pool: runtime.pool.clone(),
            usage: runtime.dependency_usage.clone(),
            root: config.repo_root.clone(),
            tree: runtime.inventory_tree.clone(),
            side: side.clone(),
            setup: bundle_inputs::params(config, &[], side),
            working_env: runtime.vite_base_env.clone(),
            transformed: Mutex::default(),
        }
    }
}

impl Transform for ViteStylesheets {
    fn stylesheet(&self, path: &str) -> Result<Arc<Stylesheet>> {
        let mut transformed = self
            .transformed
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(result) = transformed.get(path) {
            return Ok(result.clone());
        }
        let file = match self
            .side
            .physical_source(path, self.tree.as_ref(), &self.root)
        {
            Ok(file) => file,
            Err(source) => {
                return Err(InternalError::Provider {
                    source: Box::new(source),
                }
                .into());
            }
        };
        let request = Call::TransformViteCss(TransformViteCss {
            setup: self.setup.clone(),
            stylesheet: path.into(),
            file: file.to_string_lossy().into_owned(),
        });
        let result = match self.pool.request(request) {
            Ok(MethodResult::ViteCss(result)) => result,
            Ok(_) => return Err(protocol_error()),
            Err(source) => {
                let source = RenderError::Sidecar { source };
                return Err(match source.diagnostic() {
                    Some(source) => CssError::Runtime { source },
                    None => InternalError::Provider {
                        source: Box::new(source),
                    }
                    .into(),
                });
            }
        };
        for path in result.dependencies.keys() {
            self.usage.record(&self.side.dependency_aliases, path);
        }
        if let Some(env) = &self.working_env {
            env.record(&result.metadata_inputs);
        }
        let result = Arc::new(Stylesheet {
            text: result.text,
            class_map: result.class_map,
            named_exports: result.named_exports,
            source_digest: result.source_digest,
            dependencies: result.dependencies,
            imported_by: result.imported_by,
            metadata: result.metadata_inputs,
        });
        transformed.insert(path.into(), result.clone());
        Ok(result)
    }
}

fn protocol_error() -> CssError {
    InternalError::Provider {
        source: Box::new(std::io::Error::other(
            "expected an inline Vite stylesheet result",
        )),
    }
    .into()
}
