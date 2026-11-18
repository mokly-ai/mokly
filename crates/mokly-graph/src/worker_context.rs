//! Carry tracing and the render scheduling class into render workers.

use crate::render_class::RenderClass;

/// Tracing state and scheduling class cross each worker boundary together.
pub(crate) struct WorkerContext {
    parent: tracing::Span,
    dispatch: tracing::Dispatch,
    class: RenderClass,
}

impl WorkerContext {
    pub(crate) fn current() -> Self {
        Self {
            parent: tracing::Span::current(),
            dispatch: tracing::dispatcher::get_default(Clone::clone),
            class: RenderClass::current(),
        }
    }

    pub(crate) fn in_scope<T>(&self, operation: impl FnOnce() -> T) -> T {
        self.class.in_scope(|| {
            tracing::dispatcher::with_default(&self.dispatch, || self.parent.in_scope(operation))
        })
    }
}
