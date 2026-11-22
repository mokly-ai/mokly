//! Serial and batched compilations use identical record creation and delivery.

use std::sync::Arc;

use mokly_css::error::Result;
use mokly_css::types::{Bundle, StylesheetRoot};

use crate::stylesheet_cache::{CachedStylesheets, lock};
use crate::stylesheet_compiler::Compilation;
use crate::stylesheet_record::Record;
use crate::stylesheet_store::StylesheetCache;

impl CachedStylesheets {
    /// Keep the formatted key's allocation for the local store and clone it for sharing.
    pub(super) fn key(&self, root: &StylesheetRoot) -> String {
        format!("{}:{root:?}", self.settings)
    }

    /// An existing guard belongs only to the plain-CSS batch, which has no context evidence.
    pub(super) fn commit(
        &self,
        key: String,
        compilation: Compilation,
        shared: Option<&mut StylesheetCache>,
    ) -> Result<Bundle> {
        let record = Arc::new(Record::new(
            self.tree.as_ref(),
            &self.root,
            compilation,
            |digest, evidence| self.context(digest, evidence),
        ));
        let shared_key = key.clone();
        match shared {
            Some(shared) => insert(shared, shared_key, &record),
            None => insert(&mut lock(&self.shared), shared_key, &record),
        }
        lock(&self.local).insert(key, record.clone());
        self.deliver(&record)
    }
}

fn insert(shared: &mut StylesheetCache, key: String, record: &Arc<Record>) {
    if record.shareable() {
        shared.insert(key, record.clone());
    } else {
        shared.reject(key);
    }
}
