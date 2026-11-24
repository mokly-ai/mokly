//! Private evidence for working dotenv files read by the base Vite setup.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_compare::base_vite_env::ViteEnvInputs;
use mokly_sidecar::bundle_params::ViteBaseEnv;

use crate::runtime::Runtime;

pub(crate) const WORKING_ENV_PREFIX: &str = "node_modules/.mokly-roots/vite-env/";

pub(crate) struct WorkingEnvInputs {
    pub(crate) transport: ViteBaseEnv,
    evidence: Mutex<ViteEnvInputs>,
}

impl Runtime {
    /// Allow the historical Vite setup to read untracked working dotenv candidates.
    pub fn with_vite_base_env(mut self, working_root: &Path, indexed: Vec<String>) -> Self {
        let evidence = ViteEnvInputs {
            working_root: working_root.into(),
            indexed: indexed.clone(),
            files: BTreeMap::new(),
            consistent: true,
        };
        self.vite_base_env = Some(Arc::new(WorkingEnvInputs {
            transport: ViteBaseEnv {
                working_root: working_root.to_string_lossy().into_owned(),
                indexed,
            },
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
    pub(crate) fn record(&self, metadata: &BTreeMap<String, Option<String>>) {
        let mut evidence = self
            .evidence
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        for (name, digest) in metadata {
            let Some(name) = name.strip_prefix(WORKING_ENV_PREFIX) else {
                continue;
            };
            if let Some(prior) = evidence.files.insert(name.into(), digest.clone()) {
                evidence.consistent &= prior == *digest;
            }
        }
    }
}

pub(crate) fn working_candidate(path: &Path, root: &Path, working: &Path) -> Option<PathBuf> {
    let relative = path
        .strip_prefix(root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    Some(working.join(relative.strip_prefix(WORKING_ENV_PREFIX)?))
}
