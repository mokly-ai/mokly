//! Render scheduling class carried across graph worker boundaries.

use std::cell::Cell;

thread_local! {
    static CURRENT: Cell<RenderClass> = const { Cell::new(RenderClass::Foreground) };
}

/// Foreground calls precede waiting calls from a started background view.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum RenderClass {
    /// An HTTP render or other current work.
    #[default]
    Foreground,
    /// A view rendered by Serve's background usage pass.
    Background,
}

impl RenderClass {
    /// Read the current blocking render's scheduling class.
    pub fn current() -> Self {
        CURRENT.get()
    }

    /// Install the class for an operation and restore the prior class on return.
    pub fn in_scope<T>(self, operation: impl FnOnce() -> T) -> T {
        let _restore = Restore(CURRENT.replace(self));
        operation()
    }
}

struct Restore(RenderClass);

impl Drop for Restore {
    fn drop(&mut self) {
        CURRENT.set(self.0);
    }
}

#[cfg(test)]
#[path = "_tests_/render_class_tests.rs"]
mod render_class_tests;
