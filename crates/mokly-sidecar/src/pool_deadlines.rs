//! Request deadlines, with a render deadline that only debug builds can shorten.

use crate::methods::Call;
use crate::pool::Pool;

/// A test-only render deadline for process tests of a hanging render.
///
/// Release builds compile this type with no field and no setter, so no
/// release caller can change a deadline through it. Only the protocol
/// defaults and `PoolOptions::timeout_ms` apply there.
#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct TestDeadlines {
    #[cfg(debug_assertions)]
    render_ms: Option<u64>,
}

impl TestDeadlines {
    /// The shortened deadline of a render call, when a debug build set one.
    #[cfg(debug_assertions)]
    fn render(self, call: &Call) -> Option<u64> {
        let render = matches!(
            call,
            Call::RenderScreen(_)
                | Call::RenderComponent(_)
                | Call::RenderStory(_)
                | Call::RenderPage(_)
        );
        self.render_ms.filter(|_| render)
    }

    /// Release builds never shorten a deadline.
    #[cfg(not(debug_assertions))]
    fn render(self, _call: &Call) -> Option<u64> {
        None
    }
}

impl Pool {
    /// Debug builds only: replace the deadline of every render call.
    ///
    /// The process test of a hanging render uses it, so that its two
    /// attempts do not each wait a real 10-second deadline. The process start
    /// and every other call keep their deadlines. Release builds do not
    /// compile this method, so they always keep the production deadlines.
    #[cfg(debug_assertions)]
    pub fn with_test_render_deadline(mut self, deadline_ms: u64) -> Self {
        self.test_deadlines.render_ms = Some(deadline_ms);
        self
    }

    /// The deadline of one call.
    pub(super) fn deadline(&self, call: &Call) -> u64 {
        deadline(self.test_deadlines, self.options.timeout_ms, call)
    }
}

/// A debug render override first, then the environment override, then the
/// protocol default of the call.
fn deadline(test: TestDeadlines, timeout_ms: Option<u64>, call: &Call) -> u64 {
    test.render(call)
        .or(timeout_ms)
        .unwrap_or_else(|| call.timeout_ms())
}

#[cfg(all(test, debug_assertions))]
#[path = "_tests_/pool_deadlines_tests.rs"]
mod pool_deadlines_tests;
