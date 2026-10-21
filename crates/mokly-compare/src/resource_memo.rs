//! Per-comparison resource facts and bounded bytes, shared by moves and every view.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_css::parsed_cache::ParsedCssCache;
use mokly_css::rules::RuleDiff;
use mokly_css::syntax;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_graph::urls::local_target;
use mokly_model::material::digest;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_error::CompareResult;
use crate::error::{InternalError, Result};
use crate::resource_memo_state::{MemoState, PairKey};

/// Operation counts and retained-byte charges, independent of elapsed time.
#[derive(Clone, Copy, Debug, Default)]
pub struct ResourceWork {
    /// Generation resource byte reads and digest requests.
    pub reads: usize,
    /// Returned resource bytes; streamed digest input is not retained or counted here.
    pub read_bytes: usize,
    /// Actual byte comparisons of a route pair.
    pub comparisons: usize,
    /// Actual stylesheet diffs.
    pub diffs: usize,
    /// Peak charged resource-byte cache size.
    pub retained_bytes: usize,
    /// Peak charged stylesheet-diff cache size.
    pub retained_diff_bytes: usize,
}

#[derive(Clone)]
pub(crate) struct ResourceFact {
    pub(crate) unavailable: bool,
    pub(crate) digest: Option<String>,
    pub(crate) imports: Vec<String>,
    pub(crate) references: Vec<String>,
}

pub(crate) trait ResourceMemo: Send + Sync {
    fn fact(&self, side: ReviewSide, route: &str) -> Result<ResourceFact>;
    fn read(&self, side: ReviewSide, route: &str) -> Result<Option<Arc<[u8]>>>;
    fn fingerprint(
        &self,
        side: ReviewSide,
        route: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Option<String>>;
    fn equal(&self, before: &str, after: &str, aliases: &BTreeMap<String, String>) -> Result<bool>;
    fn diff(
        &self,
        before: &str,
        after: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Arc<RuleDiff>>;
    fn inline_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>>;
    fn owned_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>>;
    fn work(&self) -> ResourceWork;
}

pub(crate) struct Memo {
    pub(crate) before: Arc<dyn RenderGeneration>,
    pub(crate) after: Arc<dyn RenderGeneration>,
    pub(crate) css: Arc<dyn ParsedCssCache>,
    pub(crate) state: Mutex<MemoState>,
}

impl Memo {
    pub(crate) fn new(
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
        css: Arc<dyn ParsedCssCache>,
        bound: usize,
    ) -> Self {
        Self {
            before,
            after,
            css,
            state: Mutex::new(MemoState::new(bound)),
        }
    }
}

impl ResourceMemo for Memo {
    fn fact(&self, side: ReviewSide, route: &str) -> Result<ResourceFact> {
        if let Some(fact) = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .facts
            .get(&(side, route.into()))
            .cloned()
        {
            return Ok(fact);
        }
        if !route.ends_with(".css") {
            let generation = if side == ReviewSide::Before {
                &self.before
            } else {
                &self.after
            };
            let (digest, unavailable) = match generation.resource_digest(route) {
                Err(GraphError::ResourceUnavailable { .. }) => (None, true),
                other => (other.compare()?, false),
            };
            let fact = ResourceFact {
                unavailable,
                digest,
                imports: Vec::new(),
                references: Vec::new(),
            };
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.work.reads += 1;
            state.facts.insert((side, route.into()), fact.clone());
            return Ok(fact);
        }
        self.read(side, route)?;
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .facts
            .get(&(side, route.into()))
            .cloned()
            .ok_or_else(|| {
                InternalError::MissingResourceFact {
                    route: route.into(),
                }
                .into()
            })
    }

    fn read(&self, side: ReviewSide, route: &str) -> Result<Option<Arc<[u8]>>> {
        let key = (side, route.to_owned());
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state
                .facts
                .get(&key)
                .is_some_and(|fact| fact.digest.is_none())
            {
                return Ok(None);
            }
            if let Some(bytes) = state.bytes.get(&key) {
                return Ok(Some(bytes));
            }
        }
        let generation = if side == ReviewSide::Before {
            &self.before
        } else {
            &self.after
        };
        let (bytes, unavailable) = match generation.resource_bytes(route) {
            Err(GraphError::ResourceUnavailable { .. }) => (None, true),
            other => (other.compare()?.map(Arc::<[u8]>::from), false),
        };
        let references = bytes
            .as_deref()
            .filter(|_| route.ends_with(".css"))
            .map_or_else(Vec::new, |bytes| {
                syntax::references(&String::from_utf8_lossy(bytes))
            });
        let imports = references
            .iter()
            .filter(|reference| reference.import)
            .filter_map(|reference| local_target(route, &reference.value).ok().flatten())
            .collect();
        let references = references
            .iter()
            .filter_map(|reference| local_target(route, &reference.value).ok().flatten())
            .collect();
        let fact = ResourceFact {
            unavailable,
            digest: bytes.as_deref().map(digest),
            imports,
            references,
        };
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.work.reads += 1;
        state.work.read_bytes += bytes.as_ref().map_or(0, |bytes| bytes.len());
        state.facts.entry(key.clone()).or_insert(fact);
        if let Some(bytes) = &bytes {
            state
                .bytes
                .insert(key, bytes.clone(), bytes.len() + 128 + route.len() * 2);
        }
        state.work.retained_bytes = state.work.retained_bytes.max(state.bytes.bytes());
        Ok(bytes)
    }

    fn fingerprint(
        &self,
        side: ReviewSide,
        route: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Option<String>> {
        self.normalized_fingerprint(side, route, aliases)
    }

    fn equal(&self, before: &str, after: &str, aliases: &BTreeMap<String, String>) -> Result<bool> {
        let key = PairKey::new(before, after, aliases);
        if let Some(equal) = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .equal
            .get(&key)
        {
            return Ok(*equal);
        }
        let equal = self.compare_bytes(before, after, aliases)?;
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.work.comparisons += 1;
        state.equal.insert(key, equal);
        Ok(equal)
    }

    fn diff(
        &self,
        before: &str,
        after: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Arc<RuleDiff>> {
        self.stylesheet_diff(before, after, aliases)
    }

    fn inline_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>> {
        self.diff_sources(before, after)
    }

    fn owned_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>> {
        self.diff_policy(before, after, true)
    }

    fn work(&self) -> ResourceWork {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .work
    }
}

#[cfg(test)]
#[path = "_tests_/resource_memo_tests.rs"]
mod resource_memo_tests;
