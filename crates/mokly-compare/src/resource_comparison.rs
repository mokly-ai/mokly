//! Once-per-route byte proof and bounded stylesheet diff reuse.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::rules::{self, RuleDiff};
use mokly_model::material::digest;
use mokly_model::review_affected::ReviewSide;

use crate::comparison_resources::css_urls;
use crate::error::{InternalError, Result};
use crate::resource_memo::{Memo, ResourceMemo};
use crate::resource_memo_state::PairKey;

impl Memo {
    pub(crate) fn normalized_fingerprint(
        &self,
        side: ReviewSide,
        route: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Option<String>> {
        let fact = self.fact(side, route)?;
        if !route.ends_with(".css") {
            return Ok(fact.digest);
        }
        let aliases: BTreeMap<_, _> = fact
            .references
            .iter()
            .filter_map(|path| {
                aliases
                    .get(path)
                    .map(|target| (path.clone(), target.clone()))
            })
            .collect();
        let key = (side, route.to_owned(), aliases.clone());
        if let Some(hash) = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .fingerprints
            .get(&key)
            .cloned()
        {
            return Ok(hash);
        }
        let hash = self
            .read(side, route)?
            .map(|bytes| digest(&css_urls(&bytes, route, &aliases)));
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .fingerprints
            .insert(key, hash.clone());
        Ok(hash)
    }

    pub(crate) fn compare_bytes(
        &self,
        before: &str,
        after: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<bool> {
        let left = self.fact(ReviewSide::Before, before)?;
        let right = self.fact(ReviewSide::After, after)?;
        if !after.ends_with(".css") && left.digest != right.digest {
            return Ok(false);
        }
        let left = self.read(ReviewSide::Before, before)?;
        let right = self.read(ReviewSide::After, after)?;
        Ok(if after.ends_with(".css") && !aliases.is_empty() {
            css_urls(left.as_deref().unwrap_or_default(), before, aliases)
                == css_urls(
                    right.as_deref().unwrap_or_default(),
                    after,
                    &BTreeMap::new(),
                )
        } else {
            left == right
        })
    }

    pub(crate) fn stylesheet_diff(
        &self,
        before: &str,
        after: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Arc<RuleDiff>> {
        let key = PairKey::new(before, after, aliases);
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(content) = state.diff_keys.get(&key).cloned()
                && let Some(diff) = state.diffs.get(&content)
            {
                return Ok(diff);
            }
        }
        let left = self.read(ReviewSide::Before, before)?;
        let right = self.read(ReviewSide::After, after)?;
        let left = css_urls(left.as_deref().unwrap_or_default(), before, aliases);
        let right = css_urls(
            right.as_deref().unwrap_or_default(),
            after,
            &BTreeMap::new(),
        );
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .diff_keys
            .insert(key, (digest(&left), digest(&right)));
        self.diff_sources(&left, &right)
    }

    pub(crate) fn diff_sources(&self, left: &[u8], right: &[u8]) -> Result<Arc<RuleDiff>> {
        let key = (digest(left), digest(right));
        if let Some(diff) = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .diffs
            .get(&key)
        {
            return Ok(diff);
        }
        let diff = Arc::new(rules::diff(&self.css.parse(left), &self.css.parse(right)));
        let bytes = match serde_json::to_vec(diff.as_ref()) {
            Ok(bytes) => bytes,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.work.diffs += 1;
        state.diffs.insert(
            key,
            diff.clone(),
            bytes.len().saturating_mul(4).saturating_add(512),
        );
        state.work.retained_diff_bytes = state.work.retained_diff_bytes.max(state.diffs.bytes());
        Ok(diff)
    }
}
