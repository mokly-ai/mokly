//! The source-root selection used by NodeFactory must silence only pending base text.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_sidecar::operations::Operation;
use mokly_sidecar::workers::{Diagnostics, DiagnosticsMock};
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_diagnostics::{DiagnosticRouting, RootDiagnostics};
use crate::serve_eager_events::{
    OrderedEvents, PreparationEvent, PreparationEvents, PreparationSinkMock,
};

#[test]
fn eager_sidecar_source_routing_buffers_text_and_keeps_head_timing_and_operations_immediate() {
    let text = Arc::new(Mutex::new(Vec::new()));
    let seen = text.clone();
    let inner = Arc::new(Unimock::new((
        DiagnosticsMock::emit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, line| {
                seen.lock().unwrap().push(line.to_owned())
            })),
        DiagnosticsMock::timing
            .some_call(matching!("timing"))
            .returns(()),
        DiagnosticsMock::operation
            .some_call(matching!(Operation::Esbuild, 7))
            .returns(()),
    )));
    let router = RootDiagnostics::new(inner);
    let events: Arc<dyn PreparationEvents> = Arc::new(OrderedEvents::default());
    router.prepare(Path::new("/base"), events.clone());
    let base = router.for_source_root(Path::new("/base")).unwrap();
    base.emit("plugin diagnostic");
    base.emit("stderr diagnostic");
    base.timing("timing");
    base.operation(Operation::Esbuild, 7);
    router
        .for_source_root(Path::new("/head"))
        .unwrap()
        .emit("head diagnostic");
    let before = text.lock().unwrap().clone();
    let replayed = Arc::new(Mutex::new(Vec::new()));
    let collected = replayed.clone();
    let sink = Arc::new(
        Unimock::new(
            PreparationSinkMock::report
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, event| {
                    collected.lock().unwrap().push(event.clone());
                    Ok(true)
                })),
        )
        .no_verify_in_drop(),
    );
    events.adopt(sink).unwrap();
    assert_eq!(before, ["head diagnostic"]);
    assert_eq!(
        *replayed.lock().unwrap(),
        [
            PreparationEvent::Diagnostic("plugin diagnostic".into()),
            PreparationEvent::Diagnostic("stderr diagnostic".into())
        ]
    );
}
