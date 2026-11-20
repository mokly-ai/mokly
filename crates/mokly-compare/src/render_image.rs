//! Pin the Linux running image and use an embedded native build identity elsewhere.

#[cfg(target_os = "linux")]
use std::fs::File;
#[cfg(target_os = "linux")]
use std::io::Read;
use std::sync::{Arc, OnceLock};

use mokly_git::control::Cancellation;
use sha2::{Digest, Sha256};

use crate::render_identity::NativeIdentity;

/// One bounded image read, supplied at the command boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ImageSourceMock))]
pub trait ImageSource: Send + Sync {
    /// Read the actual image or its embedded build identity, with cancellation.
    fn digest(&self) -> Option<[u8; 32]>;
    /// Cancellation is a normal optional-cache event.
    fn cancelled(&self) -> bool;
}

/// Streaming running-image reader with no executable-path reopening.
pub struct SystemImage {
    /// Unique native build identity embedded by the native build script.
    pub embedded: String,
    /// Lifetime of this Serve command.
    pub cancellation: Arc<dyn Cancellation>,
}

impl ImageSource for SystemImage {
    fn digest(&self) -> Option<[u8; 32]> {
        let mut hash = Sha256::new();
        hash.update(self.embedded.as_bytes());
        #[cfg(target_os = "linux")]
        {
            let mut image = File::open("/proc/self/exe").ok()?;
            let before = image.metadata().ok()?;
            let modified = before.modified().ok()?;
            let mut bytes = [0; 64 * 1024];
            loop {
                if self.cancellation.cancelled() {
                    return None;
                }
                let length = image.read(&mut bytes).ok()?;
                if length == 0 {
                    break;
                }
                hash.update(&bytes[..length]);
            }
            let after = image.metadata().ok()?;
            if before.len() != after.len() || modified != after.modified().ok()? {
                return None;
            }
        }
        (!self.cancellation.cancelled()).then(|| hash.finalize().into())
    }

    fn cancelled(&self) -> bool {
        self.cancellation.cancelled()
    }
}

/// A nonblocking identity sample with one writer-owned initialization.
pub struct ImageIdentity {
    source: Arc<dyn ImageSource>,
    digest: OnceLock<Option<[u8; 32]>>,
}

impl ImageIdentity {
    /// Construction starts no process and reads no image bytes.
    pub fn new(source: Arc<dyn ImageSource>) -> Self {
        Self {
            source,
            digest: OnceLock::new(),
        }
    }
}

impl NativeIdentity for ImageIdentity {
    #[tracing::instrument(name = "render.store.identity", skip_all)]
    fn prepare(&self) {
        self.digest.get_or_init(|| self.source.digest());
    }

    fn current(&self) -> Option<[u8; 32]> {
        self.digest.get().copied().flatten()
    }

    fn cancelled(&self) -> bool {
        self.source.cancelled()
    }
}
