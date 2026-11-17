//! Carry the current tracing subscriber and parent into render workers.

/// A span and its subscriber must cross the pool boundary together.
pub(crate) struct WorkerContext {
    parent: tracing::Span,
    dispatch: tracing::Dispatch,
}

impl WorkerContext {
    pub(crate) fn current() -> Self {
        Self {
            parent: tracing::Span::current(),
            dispatch: tracing::dispatcher::get_default(Clone::clone),
        }
    }

    pub(crate) fn in_scope<T>(&self, operation: impl FnOnce() -> T) -> T {
        tracing::dispatcher::with_default(&self.dispatch, || self.parent.in_scope(operation))
    }
}
