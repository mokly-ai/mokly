//! Recoverable versioned bundle recipes over the shared nonblocking cache.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_sidecar::bundle_outcomes::{EntryFault, SkipReason};
use mokly_sidecar::bundle_store::{BundleStore, ReadMiss, ReadOutcome, RecordToken, WriteOutcome};
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::reusable_recipe::ReusableRecipe;

use crate::bundle_cache_types::{BundleCache, Mutation, RawRead};
use crate::bundle_codec::{self, Codec};
use crate::error::{Error, Result};

/// Process-scoped optional recipe store. A store fault disables it once.
pub struct CachedBundles {
    cache: Arc<dyn BundleCache>,
    version: String,
    enabled: AtomicBool,
    codec: Codec,
}

impl CachedBundles {
    /// Compose command or pool cancellation through the supplied cache.
    pub fn new(cache: Arc<dyn BundleCache>, version: String) -> Self {
        Self {
            cache,
            version,
            enabled: AtomicBool::new(true),
            codec: Codec::default(),
        }
    }

    fn fault(&self) -> WriteOutcome {
        if self.enabled.swap(false, Ordering::AcqRel) {
            WriteOutcome::StoreFault
        } else {
            WriteOutcome::Disabled
        }
    }

    fn mutation(&self, result: Result<Mutation>) -> WriteOutcome {
        match result {
            Ok(Mutation::Written) => WriteOutcome::Written,
            Ok(Mutation::Invalidated) => WriteOutcome::Invalidated,
            Ok(Mutation::Skipped(reason)) => WriteOutcome::Skipped(reason),
            Err(Error::Cancelled) => WriteOutcome::Cancelled,
            Err(Error::CacheLimit { .. }) => WriteOutcome::Skipped(SkipReason::Capacity),
            Err(_) => self.fault(),
        }
    }

    fn miss(&self, error: Error) -> ReadOutcome {
        if matches!(error, Error::Cancelled) {
            return ReadOutcome::Miss(ReadMiss::Cancelled);
        }
        ReadOutcome::Miss(match self.fault() {
            WriteOutcome::StoreFault => ReadMiss::StoreFault,
            _ => ReadMiss::Disabled,
        })
    }

    fn rejected(&self, key: &str, fault: EntryFault, token: Option<RecordToken>) -> ReadOutcome {
        let retirement = self.mutation(self.cache.invalidate(key, token));
        if retirement == WriteOutcome::Cancelled {
            return ReadOutcome::Miss(ReadMiss::Cancelled);
        }
        ReadOutcome::Rejected { fault, retirement }
    }
}

impl BundleStore for CachedBundles {
    fn load(&self, params: &Bundle) -> ReadOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return ReadOutcome::Miss(ReadMiss::Disabled);
        }
        let key = match settings_key(params) {
            Ok(key) => key,
            Err(error) => return self.miss(error),
        };
        let raw = match self.cache.read(&key) {
            Ok(raw) => raw,
            Err(error) => return self.miss(error),
        };
        match raw {
            RawRead::Absent => ReadOutcome::Miss(ReadMiss::Absent),
            RawRead::Contended => ReadOutcome::Miss(ReadMiss::Contended),
            RawRead::Damaged(token) => self.rejected(&key, EntryFault::Damaged, token),
            RawRead::Unreadable(token) => self.rejected(&key, EntryFault::Unreadable, token),
            RawRead::Entry(entry) => {
                let (decoded, token, maintenance) = {
                    let mut entry = entry;
                    let decoded =
                        self.codec
                            .decode(entry.input.as_mut(), entry.bytes, params, &self.version);
                    (decoded, entry.token, entry.maintenance.take())
                };
                if self.cache.cancelled() {
                    return ReadOutcome::Miss(ReadMiss::Cancelled);
                }
                let maintenance = match maintenance {
                    None => WriteOutcome::Unchanged,
                    Some(Error::Cancelled) => WriteOutcome::Cancelled,
                    Some(_) => self.fault(),
                };
                match decoded {
                    Ok(recipe) => ReadOutcome::Hit {
                        recipe: Box::new(recipe),
                        token,
                        maintenance,
                    },
                    Err(fault)
                        if matches!(
                            maintenance,
                            WriteOutcome::StoreFault | WriteOutcome::Disabled
                        ) =>
                    {
                        ReadOutcome::Rejected {
                            fault,
                            retirement: maintenance,
                        }
                    }
                    Err(fault) => self.rejected(&key, fault, Some(token)),
                }
            }
        }
    }

    fn save(&self, recipe: &ReusableRecipe) -> WriteOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return WriteOutcome::Disabled;
        }
        let encoded = match self.codec.encode(recipe, &self.version) {
            Ok(Some(encoded)) => encoded,
            Ok(None) => return WriteOutcome::Skipped(SkipReason::Oversized),
            Err(_) => return self.fault(),
        };
        let key = match settings_key(recipe.params()) {
            Ok(key) => key,
            Err(_) => return self.fault(),
        };
        self.mutation(self.cache.replace(&key, &encoded))
    }

    fn invalidate(&self, params: &Bundle, token: &RecordToken) -> WriteOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return WriteOutcome::Disabled;
        }
        let key = match settings_key(params) {
            Ok(key) => key,
            Err(_) => return self.fault(),
        };
        self.mutation(self.cache.invalidate(&key, Some(*token)))
    }
}

/// SHA-256 settings identity. Evaluation does not select a separate disk entry.
pub fn settings_key(params: &Bundle) -> Result<String> {
    bundle_codec::settings_key(params)
}

#[cfg(test)]
#[path = "_tests_/bundle_store_tests.rs"]
mod bundle_store_tests;
