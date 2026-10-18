//! Digest-checked opaque delivery retains metadata until a consumer opens a stream.

use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::Arc;

use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::SourceTree;

use crate::error::{GraphError, InternalError, Result, invalid};
use crate::session::Session;

/// An opened generation input; consumers keep its destination private until verified.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = AssetReadMock))]
pub trait AssetRead: Send {
    /// Byte length observed on the confined open handle.
    fn length(&self) -> u64;
    /// Copy through a bounded buffer and require the generation's captured SHA-256.
    fn copy_to(&mut self, output: &mut dyn Write) -> Result<()>;
    /// Capture one immutable response when the consumer requires owned bytes.
    fn read_bytes(&mut self) -> Result<Vec<u8>> {
        let length = match usize::try_from(self.length()) {
            Ok(length) => length,
            Err(_) => return Err(invalid("asset", "asset length cannot fit in memory")),
        };
        let mut bytes = Vec::with_capacity(length);
        self.copy_to(&mut bytes)?;
        Ok(bytes)
    }
}

struct PreparedAsset {
    stream: Box<dyn SourceStream>,
    path: PathBuf,
    expected: String,
    _tree: Arc<dyn SourceTree>,
}

impl AssetRead for PreparedAsset {
    fn length(&self) -> u64 {
        self.stream.length()
    }
    fn copy_to(&mut self, output: &mut dyn Write) -> Result<()> {
        source(
            self.stream
                .copy_verified(&self.path, &self.expected, output),
        )
    }
}

impl Session {
    pub(crate) fn open_asset_input(&self, route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        let Some(asset) = self
            .state
            .resources
            .get(route)
            .and_then(|plan| plan.asset.as_ref())
        else {
            return Ok(None);
        };
        let stream = match self.state.tree.open_stream(&asset.source) {
            Ok(stream) => stream,
            Err(SourceError::Io { source, .. }) if source.kind() != io::ErrorKind::Interrupted => {
                return Err(GraphError::InputsChanged {
                    path: asset.source.clone(),
                });
            }
            Err(error) => return source(Err(error)),
        };
        Ok(Some(Box::new(PreparedAsset {
            stream,
            path: asset.source.clone(),
            expected: asset.digest.clone(),
            _tree: self.state.tree.clone(),
        })))
    }
}

fn source<T>(result: mokly_source_interface::error::Result<T>) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(SourceError::Changed { path }) => Err(GraphError::InputsChanged { path }),
        Err(SourceError::Io { source, .. }) if source.kind() == io::ErrorKind::Interrupted => {
            Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "build cancelled".into(),
                },
            })
        }
        Err(source) => Err(InternalError::Provider {
            source: Box::new(source),
        }
        .into()),
    }
}
