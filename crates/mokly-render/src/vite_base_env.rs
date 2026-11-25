//! Private evidence for working dotenv files read by the base Vite setup.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_compare::base_vite_env::{ViteEnvInputs, candidate_digest};
use mokly_css::error::{CssError, InternalError, Result};
use mokly_css::types::Bundle;
use mokly_sidecar::bundle_params::ViteBaseEnv;
use mokly_sidecar::vite_env::ViteEnvInput;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::SourceTree;

use crate::input_stamp::InputStamp;
use crate::runtime::Runtime;
use crate::stylesheet_cache::CachedStylesheets;

pub(crate) struct WorkingEnvInputs {
    pub(crate) transport: ViteBaseEnv,
    evidence: Mutex<ViteEnvInputs>,
}

impl Runtime {
    /// Give the historical Vite setup its pinned and working dotenv selection.
    pub fn with_vite_base_env(mut self, transport: ViteBaseEnv) -> Self {
        let evidence = ViteEnvInputs::new(&transport);
        self.vite_base_env = Some(Arc::new(WorkingEnvInputs {
            transport,
            evidence: Mutex::new(evidence),
        }));
        self
    }

    /// Capture the working dotenv candidates probed by this prepared base.
    pub fn vite_base_env_inputs(&self) -> Option<ViteEnvInputs> {
        let env = self.vite_base_env.as_ref()?;
        Some(
            env.evidence
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone(),
        )
    }
}

impl WorkingEnvInputs {
    pub(crate) fn record<'a>(&self, inputs: impl IntoIterator<Item = &'a ViteEnvInput>) {
        let mut evidence = self
            .evidence
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        for input in inputs {
            if input.working
                && let Some(file) = &input.file
                && let Some(prior) = evidence.files.insert(file.into(), input.digest.clone())
            {
                evidence.consistent &= prior == input.digest;
            }
        }
    }
}

impl InputStamp {
    pub(crate) fn vite_env_current(&self, tree: &dyn SourceTree) -> bool {
        self.vite_env.iter().all(|input| {
            input.file.as_ref().is_none_or(|file| {
                candidate_digest(tree, Path::new(file)).is_ok_and(|actual| actual == input.digest)
            })
        })
    }
}

pub(crate) struct StylesheetEnv {
    tree: Arc<dyn SourceTree>,
    base: Option<Arc<WorkingEnvInputs>>,
}

impl StylesheetEnv {
    pub(crate) fn current(&self, stamp: &InputStamp) -> bool {
        stamp.vite_env_current(self.tree.as_ref())
    }

    pub(crate) fn deliver(&self, stamp: &InputStamp, bundle: &mut Bundle) -> Result<()> {
        if let Some(base) = &self.base {
            base.record(&stamp.vite_env);
        }
        for input in stamp.vite_env.iter().filter(|input| input.render) {
            bundle.resolution_files.insert(input.name.clone());
            if let Some(digest) = &input.digest {
                let baseline = ReadBaseline::Late(digest.clone());
                if let Some(file) = &input.file
                    && let Err(source) = self.tree.observe_input(Path::new(file), &baseline)
                {
                    return Err(CssError::Internal(InternalError::Provider {
                        source: Box::new(source),
                    }));
                }
                bundle.read_evidence.insert(input.name.clone(), baseline);
            }
        }
        Ok(())
    }
}

impl CachedStylesheets {
    pub(crate) fn with_vite_env(mut self, runtime: &Runtime) -> Self {
        self.vite_env = Some(StylesheetEnv {
            tree: runtime.dependency_tree.clone(),
            base: runtime.vite_base_env.clone(),
        });
        self
    }
}
