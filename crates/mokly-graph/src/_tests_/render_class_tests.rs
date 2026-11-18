//! Background context must not remain on a reused caller or graph worker.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::render_class::RenderClass;
use crate::workers::{ComparisonTaskMock, RenderWorkers, ThreadWorkers};

#[test]
fn background_scope_restores_foreground_on_the_caller_and_reused_graph_worker() {
    let classes = Arc::new(Mutex::new(Vec::new()));
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(0))
            .answers_arc(Arc::new({
                let classes = classes.clone();
                move |_, _| classes.lock().unwrap().push(RenderClass::current())
            }))
            .n_times(2),
    );
    let workers = ThreadWorkers::new(1).unwrap();
    assert_eq!(RenderClass::current(), RenderClass::Foreground);
    RenderClass::Background.in_scope(|| {
        workers.comparison_tasks(1, &task);
        assert_eq!(RenderClass::current(), RenderClass::Background);
    });
    workers.comparison_tasks(1, &task);
    assert_eq!(
        *classes.lock().unwrap(),
        [RenderClass::Background, RenderClass::Foreground]
    );
    assert_eq!(RenderClass::current(), RenderClass::Foreground);
}
