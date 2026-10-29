//! Hash and optional converted length of an opaque historical source.

/// One opaque source digest and its converted byte length.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceDigest {
    /// SHA-256 of the converted source bytes.
    pub hash: String,
    /// Converted length, when the adapter can prove it without retaining bytes.
    pub length: Option<usize>,
}
