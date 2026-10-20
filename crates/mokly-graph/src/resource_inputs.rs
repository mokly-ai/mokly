//! Render-discovered resource edges live only while their source recipes are leased.

use std::collections::BTreeMap;
use std::fmt::Debug;
use std::sync::Mutex;

/// Cross-generation dependencies keyed by a document's source recipe.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ResourceInputsMock))]
pub trait ResourceInputs: Debug + Send + Sync {
    /// Lease a recipe while one graph uses it.
    fn retain(&self, recipe: &str);
    /// Release its metadata after the final graph or request.
    fn release(&self, recipe: &str);
    /// Keep the first observed digest, including an unavailable lexical target.
    fn record(&self, recipe: &str, path: &str, digest: Option<String>);
    /// Return baseline digests for the same source recipe.
    fn paths(&self, recipe: &str) -> BTreeMap<String, Option<String>>;
}

#[derive(Debug, Default)]
struct Recipe {
    users: usize,
    paths: BTreeMap<String, Option<String>>,
}

/// Metadata shares active recipes without retaining historical generations or file bytes.
#[derive(Debug, Default)]
pub struct MemoryResourceInputs {
    inputs: Mutex<BTreeMap<String, Recipe>>,
}

impl ResourceInputs for MemoryResourceInputs {
    fn retain(&self, recipe: &str) {
        self.inputs
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .entry(recipe.into())
            .or_default()
            .users += 1;
    }
    fn release(&self, recipe: &str) {
        let mut inputs = self.inputs.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = inputs.get_mut(recipe) {
            entry.users = entry.users.saturating_sub(1);
        }
        if inputs.get(recipe).is_some_and(|entry| entry.users == 0) {
            inputs.remove(recipe);
        }
    }
    fn record(&self, recipe: &str, path: &str, digest: Option<String>) {
        let mut inputs = self.inputs.lock().unwrap_or_else(|e| e.into_inner());
        inputs
            .entry(recipe.into())
            .or_default()
            .paths
            .entry(path.into())
            .or_insert(digest);
    }
    fn paths(&self, recipe: &str) -> BTreeMap<String, Option<String>> {
        self.inputs
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(recipe)
            .map(|recipe| recipe.paths.clone())
            .unwrap_or_default()
    }
}

/// A weak subscriber observes new resource inputs as soon as a render reaches them.
pub trait ResourceObserver: Send + Sync {
    /// Attach the lexical path without making a denied target public.
    fn observe(&self, generation: &str, path: &str);
}
