//! Accepted side identities and injected move-equality evidence.

use std::collections::BTreeMap;
use std::fmt;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::review_affected::ReviewSide;

use crate::error::Result;

/// One proven path move, with each side's original case.
#[derive(Clone, Debug)]
pub struct MovePair {
    /// Equal entry kind on both sides.
    pub kind: EntryKind,
    /// Current complete path.
    pub path: String,
    /// Base complete path.
    pub previous_path: String,
}

/// One identity in the union of both validated catalogues.
#[derive(Clone, Debug)]
pub struct EntryPair {
    /// Base entry index, absent for additions.
    pub before: Option<usize>,
    /// Current entry index, absent for removals.
    pub after: Option<usize>,
    /// True only for accepted path moves, never case-only renames.
    pub moved: bool,
}

/// One comparison generation's complete pairing.
#[derive(Clone, Debug, Default)]
pub struct Pairing {
    /// Complete surviving side union. Cross-kind superseded removals are absent.
    pub entries: Vec<EntryPair>,
    /// Accepted moves of all kinds, sorted by current path.
    pub moves: Vec<MovePair>,
    /// Exact diagnostics in production order.
    pub diagnostics: Vec<String>,
}

impl Pairing {
    /// Map historical references to accepted current spellings, including case-only names.
    pub fn paths(
        &self,
        before: &CatalogueModel,
        after: &CatalogueModel,
    ) -> BTreeMap<String, String> {
        self.entries
            .iter()
            .filter_map(|pair| {
                Some((
                    before
                        .entries
                        .get(pair.before?)?
                        .metadata
                        .path
                        .to_ascii_lowercase(),
                    after.entries.get(pair.after?)?.metadata.path.clone(),
                ))
            })
            .collect()
    }
}

/// Hash prefilter. Equality still requires paired tree and resource proof.
#[derive(Clone, Debug)]
pub struct MoveSignature {
    /// Normalized material hash.
    pub hash: String,
    /// Ignore identities and material-key presence; differing contracts require paired proof.
    pub ignores: Vec<(String, bool)>,
}

/// Author-visible lines after the two candidates' shared canonical projection.
pub struct MoveLines {
    /// Base author content.
    pub before: Vec<String>,
    /// Current author content.
    pub after: Vec<String>,
}

/// Impure move evidence is rendered through the same generation provider as classification.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MoveEvidenceMock))]
pub trait MoveEvidence: Send + Sync {
    /// Hash one candidate's complete view material with accepted logical references.
    fn signature(
        &self,
        side: ReviewSide,
        entry: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<MoveSignature>;
    /// Verify corresponding views and resources; a hash alone is never proof.
    fn equal(&self, before: usize, after: usize, paths: &BTreeMap<String, String>) -> Result<bool>;
    /// Markdown author lines or a page's static body text; no template fallback.
    fn lines(
        &self,
        before: usize,
        after: usize,
        paths: &BTreeMap<String, String>,
    ) -> Result<Option<MoveLines>>;
}

/// One pairing service is used by every classifier host.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = MoveDetectorMock))]
pub trait MoveDetector: Send + Sync {
    /// Pair existing identities, then run declared, identical, source/title, and similar passes.
    fn pair(
        &self,
        before: &CatalogueModel,
        after: &CatalogueModel,
        evidence: &dyn MoveEvidence,
    ) -> Result<Pairing>;
}

impl fmt::Debug for dyn MoveEvidence + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("MoveEvidence")
    }
}
