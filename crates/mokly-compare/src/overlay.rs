//! Commit-specific repository package overlays placed before third-party roots.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use sha2::{Digest, Sha256};

use crate::cache_types::{Builder, Cache, Kind, Lease, Storage};
use crate::error::Result;
use crate::inputs::Inputs;
use crate::local_packages;

/// Repository package overlays consumed by every dependency tier.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = OverlaysMock))]
pub trait Overlays: Send + Sync {
    /// Lease package links into this side's sources. No package manager runs.
    fn acquire(&self, inputs: &Inputs, source: &Path, identity: &str) -> Result<Option<Lease>>;
}

/// Overlay coordinator over the bounded dependency namespace.
pub struct CachedOverlays {
    /// Shared cache and process announcement.
    pub cache: Arc<dyn Cache>,
    /// Filesystem link adapter.
    pub storage: Arc<dyn Storage>,
}

struct Links<'a> {
    storage: &'a dyn Storage,
    source: &'a Path,
    packages: &'a BTreeMap<String, String>,
}

impl Builder for Links<'_> {
    fn build(&self, destination: &Path) -> Result<()> {
        self.storage
            .packages(destination, self.source, self.packages)
    }
}

impl Overlays for CachedOverlays {
    fn acquire(&self, inputs: &Inputs, source: &Path, identity: &str) -> Result<Option<Lease>> {
        let packages = local_packages::packages(&inputs.files)?;
        if packages.is_empty() {
            return Ok(None);
        }
        let mut hash = Sha256::new();
        for bytes in [
            b"mokly-package-overlay-v1".as_slice(),
            identity.as_bytes(),
            source.as_os_str().as_encoded_bytes(),
        ] {
            hash.update((bytes.len() as u64).to_le_bytes());
            hash.update(bytes);
        }
        let key: String = hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        self.cache
            .get(
                Kind::Dependencies,
                &key,
                &Links {
                    storage: self.storage.as_ref(),
                    source,
                    packages: &packages,
                },
            )
            .map(Some)
    }
}
