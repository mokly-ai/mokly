//! Cold plain-CSS roots compile in bounded chunks and commit in root order.

use std::collections::BTreeSet;
use std::panic::resume_unwind;
use std::thread;

use mokly_css::error::Result;
use mokly_css::types::{StylesheetBundler, StylesheetRoot};

use crate::render_environment::ClassMaps;
use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_cache::lock;
use crate::stylesheet_compiler::DeferredCompiler;
use crate::stylesheet_store::{Miss, StylesheetCache};

/// Preparation can compile eligible roots together before ordinary graph delivery.
#[cfg_attr(test, unimock::unimock(api = ClassMapsMock))]
pub(crate) trait ClassMapCompiler: StylesheetBundler {
    /// Merge the roots in encounter order under the supplied machine parallelism bound.
    fn class_maps(&self, roots: &[StylesheetRoot], parallelism: usize) -> Result<ClassMaps>;
}

impl ClassMapCompiler for CachedStylesheets {
    fn class_maps(&self, roots: &[StylesheetRoot], parallelism: usize) -> Result<ClassMaps> {
        let workers = parallelism.min(4).min(roots.len());
        let parallel = if workers < 2 {
            None
        } else {
            let mut shared = lock(&self.shared);
            let mut keys = BTreeSet::new();
            if shared.is_empty()
                && lock(&self.local).is_empty()
                && self.head.upgrade().is_none()
                && roots.iter().all(|root| keys.insert(self.key(root)))
            {
                let deferred: Option<Vec<_>> =
                    roots.iter().map(|_| self.inner.deferred()).collect();
                deferred.map(|deferred| self.parallel_maps(roots, &deferred, workers, &mut shared))
            } else {
                None
            }
        };
        if let Some(result) = parallel {
            return result;
        }
        let mut maps = ClassMaps::new();
        for root in roots {
            maps.extend(self.bundle(root)?.css_modules);
        }
        Ok(maps)
    }
}

impl CachedStylesheets {
    fn parallel_maps(
        &self,
        roots: &[StylesheetRoot],
        deferred: &[DeferredCompiler],
        workers: usize,
        shared: &mut StylesheetCache,
    ) -> Result<ClassMaps> {
        let dispatcher = tracing::dispatcher::get_default(Clone::clone);
        let parent = tracing::Span::current();
        let mut maps = ClassMaps::new();
        for (roots, deferred) in roots.chunks(workers).zip(deferred.chunks(workers)) {
            let outcomes = thread::scope(|scope| {
                let handles: Vec<_> = roots
                    .iter()
                    .zip(deferred)
                    .map(|(root, deferred)| {
                        let dispatcher = dispatcher.clone();
                        let parent = parent.clone();
                        scope.spawn(move || {
                            tracing::dispatcher::with_default(&dispatcher, || {
                                parent.in_scope(|| {
                                    self.compile(root, Miss::NoRecord, deferred.compiler.as_ref())
                                })
                            })
                        })
                    })
                    .collect();
                handles
                    .into_iter()
                    .map(|handle| handle.join())
                    .collect::<Vec<_>>()
            });
            for ((root, deferred), outcome) in roots.iter().zip(deferred).zip(outcomes) {
                // A failed chunk can finish up to three extra roots. Replay only the serial
                // usage prefix, including the failing root's partial reads, before delivery.
                deferred.usage.replay();
                let compilation = match outcome {
                    Ok(result) => result?,
                    Err(payload) => resume_unwind(payload),
                };
                maps.extend(
                    self.commit(self.key(root), compilation, Some(shared))?
                        .css_modules,
                );
            }
        }
        Ok(maps)
    }
}
