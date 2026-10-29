//! Byte-bounded cross-generation stylesheet reuse with dependency validation.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

use mokly_css::error::{CssError, InternalError, Result};
use mokly_css::types::{Bundle, StylesheetBundler, StylesheetRoot};
use mokly_source_interface::read_evidence::ReadEvidence;
use mokly_source_interface::tree::SourceTree;

use crate::stylesheet_record::{ContextEvidence, Record};
use crate::stylesheet_store::{Miss, StylesheetCache};

/// One attempt's stylesheet bundler: an attempt-local store in front of the shared store.
pub(crate) struct CachedStylesheets {
    inner: Arc<dyn StylesheetBundler>,
    tree: Arc<dyn SourceTree>,
    root: PathBuf,
    settings: String,
    shared: Arc<Mutex<StylesheetCache>>,
    local: Mutex<StylesheetCache>,
    /// The context entries of this attempt's new records, by evidence digest.
    contexts: Mutex<BTreeMap<String, Arc<ContextEvidence>>>,
    /// The stored context entries whose stamp this attempt checked, with the result.
    checked: Mutex<Vec<(Arc<ContextEvidence>, bool)>>,
    /// The evidence digests of the context entries that this attempt replayed.
    replayed: Mutex<BTreeSet<String>>,
}

impl CachedStylesheets {
    pub(crate) fn new(
        inner: Arc<dyn StylesheetBundler>,
        tree: Arc<dyn SourceTree>,
        root: PathBuf,
        settings: String,
        shared: Arc<Mutex<StylesheetCache>>,
    ) -> Self {
        let local = Mutex::new(lock(&shared).empty_peer());
        Self {
            inner,
            tree,
            root,
            settings,
            shared,
            local,
            contexts: Mutex::default(),
            checked: Mutex::default(),
            replayed: Mutex::default(),
        }
    }

    /// A record that this attempt may deliver, or the reason why the cache cannot serve `key`.
    fn lookup(&self, key: &str) -> std::result::Result<Arc<Record>, Miss> {
        if let Some(record) = lock(&self.local).record(key) {
            return Ok(record);
        }
        let (record, miss) = {
            let shared = lock(&self.shared);
            (shared.record(key), shared.miss(key))
        };
        let record = record.ok_or(miss)?;
        if record.stamp.current(self.tree.as_ref()) != record.stamp
            || record
                .context
                .as_ref()
                .is_some_and(|context| !self.current(context))
        {
            return Err(Miss::StampMismatch);
        }
        lock(&self.local).insert(key.into(), record.clone());
        Ok(record)
    }

    /// Check the stamp of a stored context entry once for each attempt.
    fn current(&self, context: &Arc<ContextEvidence>) -> bool {
        let mut checked = lock(&self.checked);
        let mut current = true;
        for entry in ContextEvidence::chain_arcs(context) {
            let own_current = match checked.iter().find(|(held, _)| Arc::ptr_eq(held, &entry)) {
                Some((_, current)) => *current,
                None => {
                    let current = entry.stamp.current(self.tree.as_ref()) == entry.stamp;
                    checked.push((entry, current));
                    current
                }
            };
            current &= own_current;
        }
        current
    }

    /// The entry for a new bundle's module evidence: this attempt's entry, a stored entry
    /// whose stamp holds, or a new entry.
    fn context(&self, digest: String, evidence: ReadEvidence) -> Arc<ContextEvidence> {
        let mut contexts = lock(&self.contexts);
        if let Some(entry) = contexts.get(&digest) {
            return entry.clone();
        }
        let stored = {
            let shared = lock(&self.shared);
            (shared.context(&digest), shared.contexts())
        };
        let entry = if let Some(entry) = stored.0.filter(|entry| self.current(entry)) {
            entry
        } else {
            let mut base = contexts
                .values()
                .filter(|entry| entry.is_subset_of(&evidence))
                .max_by_key(|entry| entry.full_size())
                .cloned();
            let mut size = base.as_ref().map_or(0, |entry| entry.full_size());
            for entry in stored.1 {
                let candidate_size = entry.full_size();
                if candidate_size > size && entry.is_subset_of(&evidence) && self.current(&entry) {
                    size = candidate_size;
                    base = Some(entry);
                }
            }
            Arc::new(ContextEvidence::with_base(
                self.tree.as_ref(),
                &self.root,
                digest.clone(),
                evidence,
                base,
            ))
        };
        contexts.insert(digest, entry.clone());
        entry
    }

    #[tracing::instrument(name = "css.bundle", skip_all, err, fields(cache = miss.as_str()))]
    fn compile(&self, root: &StylesheetRoot, miss: Miss) -> Result<Bundle> {
        self.inner.bundle(root)
    }

    /// Replay a record's observations into this attempt's tree. Context evidence replays once.
    fn deliver(&self, record: &Record) -> Result<Bundle> {
        self.observe(record.evidence())?;
        if let Some(context) = &record.context {
            for entry in ContextEvidence::chain_arcs(context) {
                let mut replayed = lock(&self.replayed);
                if !replayed.contains(&entry.digest) {
                    self.observe(&entry.evidence)?;
                    replayed.insert(entry.digest.clone());
                }
            }
        }
        Ok(record.complete())
    }

    fn observe(&self, evidence: &ReadEvidence) -> Result<()> {
        for (path, versions) in &evidence.inputs {
            if let Err(source) = self.tree.observe_inputs(&self.root.join(path), versions) {
                return Err(CssError::Internal(InternalError::Provider {
                    source: Box::new(source),
                }));
            }
        }
        Ok(())
    }
}

impl StylesheetBundler for CachedStylesheets {
    fn bundle(&self, root: &StylesheetRoot) -> Result<Bundle> {
        let key = format!("{}:{root:?}", self.settings);
        let miss = match self.lookup(&key) {
            Ok(record) => return self.deliver(&record),
            Err(miss) => miss,
        };
        let bundle = self.compile(root, miss)?;
        let record = Arc::new(Record::new(
            self.tree.as_ref(),
            &self.root,
            bundle,
            |digest, evidence| self.context(digest, evidence),
        ));
        {
            let mut shared = lock(&self.shared);
            if record.shareable() {
                shared.insert(key.clone(), record.clone());
            } else {
                shared.reject(key.clone());
            }
        }
        lock(&self.local).insert(key, record.clone());
        self.deliver(&record)
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|error| error.into_inner())
}

#[cfg(test)]
#[path = "_tests_/stylesheet_cache_tests.rs"]
mod stylesheet_cache_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_evidence_tests.rs"]
mod stylesheet_evidence_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_miss_tests.rs"]
mod stylesheet_miss_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_reuse_tests.rs"]
mod stylesheet_reuse_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_trace_tests.rs"]
mod stylesheet_trace_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_support.rs"]
mod stylesheet_support;

#[cfg(test)]
#[path = "_tests_/stylesheet_chain_support.rs"]
mod stylesheet_chain_support;

#[cfg(test)]
#[path = "_tests_/stylesheet_chain_tests.rs"]
mod stylesheet_chain_tests;
