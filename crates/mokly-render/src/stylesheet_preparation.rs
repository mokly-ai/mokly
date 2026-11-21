//! Attempt-local retention and reusable evidence control PostCSS context preparation.

use std::sync::Mutex;

use crate::stylesheet_cache::{CachedStylesheets, lock};
use crate::stylesheet_compiler::StylesheetPreparation;
use crate::stylesheet_store::Miss;

impl StylesheetPreparation for CachedStylesheets {
    fn kept_every_record(&self) -> bool {
        lock(&self.local).kept_every_record()
    }

    fn stale_postcss(&self) -> bool {
        let keys = lock(&self.shared).postcss_keys(&self.settings);
        keys.into_iter().any(|key| {
            if !matches!(self.lookup(&key), Err(Miss::StampMismatch)) {
                return false;
            }
            *lock(self.probe.get_or_init(Mutex::default)) = Some(key);
            true
        })
    }
}
