//! Domain-separated, content-addressed graph input keys.

use mokly_model::canonical;
use mokly_model::material::digest;
use serde_json::Value;

use crate::error::{InternalError, Result};

/// A lowercase SHA-256 node input digest; never an output-bytes digest.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct NodeKey(pub String);

/// Node kind separates equal inputs used for different graph operations.
#[derive(Clone, Copy, Debug)]
pub enum NodeKind {
    /// Resolved data-only config and Mokly version.
    Config,
    /// Digest of the complete authored file bytes.
    EntrySource,
    /// HTML component source and transitive component keys.
    HtmlComponent,
    /// CSS sources, assets, processor, and resolution inputs.
    Stylesheet,
    /// Definition, props, axes, render inputs, and enclosing ignore state.
    Fragment,
    /// One entry module's closure, resolution files, bindings, and bundle environment.
    RenderInputs,
    /// Entry, component, stylesheet, axis, resource, and config inputs.
    Document,
}

/// Hash a node's ordered inputs with unambiguous length prefixes.
pub fn key(kind: NodeKind, inputs: &[&[u8]]) -> NodeKey {
    let mut preimage = format!("mokly-graph-v1:{kind:?}:").into_bytes();
    for input in inputs {
        preimage.extend_from_slice(&(input.len() as u64).to_be_bytes());
        preimage.extend_from_slice(input);
    }
    NodeKey(digest(&preimage))
}

/// Encode structured inputs with UTF-16 object key order before hashing.
pub fn data_key(kind: NodeKind, input: Value) -> Result<NodeKey> {
    let encoded = match serde_json::to_vec(&canonical::sorted(input)) {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    Ok(key(kind, &[&encoded]))
}
