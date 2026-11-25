//! Byte-bounded cross-generation stylesheet reuse with dependency validation.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, Weak};

use mokly_css::error::{CssError, InternalError, Result};
use mokly_css::types::{Bundle, StylesheetBundler, StylesheetRoot};
use mokly_source_interface::read_evidence::ReadEvidence;
use mokly_source_interface::tree::SourceTree;

use crate::stylesheet_compiler::{Compilation, RootCompiler};
use crate::stylesheet_record::{ContextEvidence, Record};
use crate::stylesheet_store::{Miss, StylesheetCache};
use crate::vite_base_env::StylesheetEnv;

/// One attempt's stylesheet bundler: an attempt-local store in front of the shared store.
pub(crate) struct CachedStylesheets {
    /// The raw compiler prepares optional plain-CSS forks with buffered usage.
    pub(super) inner: Arc<dyn RootCompiler>,
    /// Ordered record stamps and observations use the original attempt tree.
    pub(super) tree: Arc<dyn SourceTree>,
    pub(crate) vite_env: Option<StylesheetEnv>,
    /// Logical paths in records are relative to this repository root.
    pub(super) root: PathBuf,
    /// Every root key starts with these effective configuration settings.
    pub(super) settings: String,
    /// A cold parallel batch holds this store's guard through its final commit.
    pub(super) shared: Arc<Mutex<StylesheetCache>>,
    /// A live borrowed head store requires serial lookups.
    pub(super) head: Weak<Mutex<StylesheetCache>>,
    /// An attempt's local records and miss reasons must be empty for a batch.
    pub(super) local: Mutex<StylesheetCache>,
    /// The eligibility probe stops at its first stale root, so its miss needs one key.
    pub(super) probe: OnceLock<Mutex<Option<String>>>,
    /// Non-owning indexes let the bounded stores control context payload lifetimes.
    contexts: Mutex<BTreeMap<String, Weak<ContextEvidence>>>,
    /// The stored context entries whose stamp this attempt checked, with the result.
    checked: Mutex<Vec<(Weak<ContextEvidence>, bool)>>,
    /// The evidence digests of the context entries that this attempt replayed.
    replayed: Mutex<BTreeSet<String>>,
}

impl CachedStylesheets {
    pub(crate) fn new(
        inner: Arc<dyn RootCompiler>,
        tree: Arc<dyn SourceTree>,
        root: PathBuf,
        settings: String,
        shared: Arc<Mutex<StylesheetCache>>,
    ) -> Self {
        let local = Mutex::new(lock(&shared).empty_peer());
        Self {
            inner,
            tree,
            vite_env: None,
            root,
            settings,
            shared,
            head: Weak::new(),
            local,
            probe: OnceLock::new(),
            contexts: Mutex::default(),
            checked: Mutex::default(),
            replayed: Mutex::default(),
        }
    }

    /// Historical attempts borrow head records without owning or writing the head store.
    pub(crate) fn with_head(mut self, head: Weak<Mutex<StylesheetCache>>) -> Self {
        self.head = head;
        self
    }

    /// A record that this attempt may deliver, or the reason why the cache cannot serve `key`.
    pub(super) fn lookup(&self, key: &str) -> std::result::Result<Arc<Record>, Miss> {
        if let Some(record) = lock(&self.local).record(key) {
            return Ok(record);
        }
        if self
            .probe
            .get()
            .is_some_and(|probe| lock(probe).as_deref() == Some(key))
        {
            return Err(Miss::StampMismatch);
        }
        let mut miss = lock(&self.shared).miss(key);
        for source in [Some(self.shared.clone()), self.head.upgrade()]
            .into_iter()
            .flatten()
        {
            let record = lock(&source).record(key);
            if let Some(record) = record {
                if record.stamp.matches(self.tree.as_ref())
                    && self
                        .vite_env
                        .as_ref()
                        .is_none_or(|env| env.current(&record.stamp))
                    && record
                        .context
                        .as_ref()
                        .is_none_or(|context| self.current(context))
                {
                    lock(&self.local).insert(key.into(), record.clone());
                    return Ok(record);
                }
                miss = Miss::StampMismatch;
            }
        }
        Err(miss)
    }

    /// Check the stamp of a stored context entry once for each attempt.
    fn current(&self, context: &Arc<ContextEvidence>) -> bool {
        let mut checked = lock(&self.checked);
        checked.retain(|(entry, _)| entry.strong_count() != 0);
        let mut current = true;
        for entry in ContextEvidence::chain_arcs(context) {
            let weak = Arc::downgrade(&entry);
            let own_current = match checked.iter().find(|(held, _)| Weak::ptr_eq(held, &weak)) {
                Some((_, current)) => *current,
                None => {
                    let current = entry.stamp.matches(self.tree.as_ref());
                    checked.push((weak, current));
                    current
                }
            };
            current &= own_current;
        }
        current
    }

    /// The entry for a new bundle's module evidence: this attempt's entry, a stored entry
    /// whose stamp holds, or a new entry.
    pub(super) fn context(&self, digest: String, evidence: ReadEvidence) -> Arc<ContextEvidence> {
        let mut contexts = lock(&self.contexts);
        contexts.retain(|_, entry| entry.strong_count() != 0);
        if let Some(entry) = contexts.get(&digest).and_then(Weak::upgrade) {
            return entry;
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
                .filter_map(Weak::upgrade)
                .filter(|entry| entry.is_subset_of(&evidence))
                .max_by_key(|entry| entry.full_size());
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
        contexts.insert(digest, Arc::downgrade(&entry));
        entry
    }

    #[tracing::instrument(name = "css.bundle", skip_all, err, fields(cache = miss.as_str()))]
    pub(super) fn compile(
        &self,
        root: &StylesheetRoot,
        miss: Miss,
        compiler: &dyn RootCompiler,
    ) -> Result<Compilation> {
        compiler.compile(root)
    }

    /// Replay a record's observations into this attempt's tree. Context evidence replays once.
    pub(super) fn deliver(&self, record: &Record) -> Result<Bundle> {
        self.observe(record.evidence())?;
        self.observe(record.core_evidence())?;
        if let Some(context) = &record.context {
            for entry in ContextEvidence::chain_arcs(context) {
                let mut replayed = lock(&self.replayed);
                if !replayed.contains(&entry.digest) {
                    self.observe(&entry.evidence)?;
                    replayed.insert(entry.digest.clone());
                }
            }
        }
        let mut bundle = record.complete();
        if let Some(env) = &self.vite_env {
            env.deliver(&record.stamp, &mut bundle)?;
        }
        let watched = self.inner.watch_files(&bundle.resolution_files)?;
        bundle.resolution_files = watched.files;
        bundle.resolution_roots = watched.dependency_roots;
        Ok(bundle)
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
        let key = self.key(root);
        let miss = match self.lookup(&key) {
            Ok(record) => return self.deliver(&record),
            Err(miss) => miss,
        };
        let compilation = self.compile(root, miss, self.inner.as_ref())?;
        if let Some(probe) = self.probe.get() {
            let mut probe = lock(probe);
            if probe.as_deref() == Some(key.as_str()) {
                *probe = None;
            }
        }
        self.commit(key, compilation, None)
    }
}

pub(super) fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|error| error.into_inner())
}

#[cfg(test)]
#[path = "_tests_/stylesheet_cache_tests.rs"]
mod stylesheet_cache_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_evidence_tests.rs"]
mod stylesheet_evidence_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_capture_tests.rs"]
mod stylesheet_capture_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_base_tests.rs"]
mod stylesheet_base_tests;

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

#[cfg(test)]
#[path = "_tests_/stylesheet_context_reuse_tests.rs"]
mod stylesheet_context_reuse_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_retention_tests.rs"]
mod stylesheet_retention_tests;

#[cfg(test)]
#[path = "_tests_/class_maps/mod.rs"]
mod class_maps_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_preparation_tests.rs"]
mod stylesheet_preparation_tests;

#[cfg(test)]
#[path = "_tests_/stylesheet_retirement_tests.rs"]
mod stylesheet_retirement_tests;
