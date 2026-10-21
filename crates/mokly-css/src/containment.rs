//! Immutable physical component ancestry shared by elements and detached match proof.

use std::fmt;
use std::sync::Arc;

use crate::match_tree::Containment;

/// Shared component ancestry. Cloning retains one link, without copying its ancestors.
#[derive(Default)]
pub struct ContainmentPath(Option<Arc<Link>>);

struct Link {
    region: Containment,
    parent: ContainmentPath,
    depth: usize,
}

impl Clone for ContainmentPath {
    fn clone(&self) -> Self {
        #[cfg(test)]
        copy_tests::record();
        Self(self.0.clone())
    }
}

impl ContainmentPath {
    /// Extend an ancestry path with one innermost component region.
    pub fn with_region(&self, region: Containment) -> Self {
        Self(Some(Arc::new(Link {
            region,
            parent: self.clone(),
            depth: self.len() + 1,
        })))
    }

    /// Number of containing regions, without traversing the shared path.
    pub fn len(&self) -> usize {
        self.0.as_ref().map_or(0, |link| link.depth)
    }

    /// Whether the element lies outside every component region.
    pub fn is_empty(&self) -> bool {
        self.0.is_none()
    }

    /// Visit physical regions from innermost to outermost.
    pub fn iter(&self) -> impl Iterator<Item = &Containment> {
        std::iter::successors(self.0.as_deref(), |link| link.parent.0.as_deref())
            .map(|link| &link.region)
    }
}

impl FromIterator<Containment> for ContainmentPath {
    /// Build a shared path from outermost-to-innermost region input.
    fn from_iter<T: IntoIterator<Item = Containment>>(regions: T) -> Self {
        regions
            .into_iter()
            .fold(Self::default(), |path, region| path.with_region(region))
    }
}

impl fmt::Debug for ContainmentPath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.debug_list().entries(self.iter()).finish()
    }
}

impl Drop for ContainmentPath {
    /// Release the unique prefix iteratively, including the final deep path owner.
    fn drop(&mut self) {
        let mut next = self.0.take();
        while let Some(link) = next {
            let Some(mut link) = Arc::into_inner(link) else {
                break;
            };
            next = link.parent.0.take();
        }
    }
}

#[cfg(test)]
#[path = "_tests_/containment_tests.rs"]
mod containment_tests;

#[cfg(test)]
#[path = "_tests_/observation_ownership_tests.rs"]
mod copy_tests;
