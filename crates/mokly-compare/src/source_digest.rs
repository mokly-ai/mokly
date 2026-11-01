//! Hash and optional converted length of an opaque historical source.

/// One opaque source digest and its converted byte length.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceDigest {
    /// SHA-256 of the converted source bytes.
    pub hash: String,
    /// Converted length, when the adapter can prove it without retaining bytes.
    pub length: Option<usize>,
}

/// Preparation completion is independent of a source's optional length.
#[derive(Clone, Debug)]
pub(crate) enum CachedDigest {
    HashOnly(String),
    Opaque(SourceDigest),
}

impl CachedDigest {
    pub(crate) fn record(&self) -> SourceDigest {
        match self {
            Self::HashOnly(hash) => SourceDigest {
                hash: hash.clone(),
                length: None,
            },
            Self::Opaque(record) => record.clone(),
        }
    }

    pub(crate) fn completed(&self) -> bool {
        matches!(self, Self::Opaque(_))
    }
}
