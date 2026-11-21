//! Bundle store directory events use the source root of the current synchronous operation.

use std::cell::RefCell;
use std::marker::PhantomData;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;

use mokly_compare::cache_types::{ReportScope, Reporter};

use crate::serve_eager_diagnostics::DiagnosticRouting;

pub(super) struct RootDirectory {
    pub(super) inner: Arc<dyn Reporter>,
    pub(super) routing: Arc<dyn DiagnosticRouting>,
}

thread_local! {
    static SOURCE: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

struct SourceScope {
    previous: Option<PathBuf>,
    _thread: PhantomData<Rc<()>>,
}

impl ReportScope for SourceScope {}

impl Drop for SourceScope {
    fn drop(&mut self) {
        SOURCE.with(|source| *source.borrow_mut() = self.previous.take());
    }
}

impl Reporter for RootDirectory {
    fn scope(&self, source_root: &Path) -> Option<Box<dyn ReportScope>> {
        let previous = SOURCE.with(|source| source.replace(Some(source_root.into())));
        Some(Box::new(SourceScope {
            previous,
            _thread: PhantomData,
        }))
    }
    fn opened(&self, directory: &Path) {
        let root = SOURCE.with(|source| source.borrow().clone());
        if root.is_some_and(|root| self.routing.directory(&root, directory)) {
            return;
        }
        self.inner.opened(directory);
    }
}
