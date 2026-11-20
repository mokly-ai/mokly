//! A synchronous custom generation retains its ordinary worker for the whole render.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::Artifact;
use crate::types::{RenderGeneration, RenderGenerationMock};

#[test]
fn custom_generation_default_renders_without_completion_admission_or_handoff() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let generation = Unimock::new(
        RenderGenerationMock::render
            .some_call(matching!("custom"))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, _| {
                    calls.lock().unwrap().push("render");
                    Ok(Arc::new(Artifact {
                        bytes: vec![],
                        document: None,
                        fragment: None,
                        content_type: "text/html".into(),
                    }))
                }
            })),
    );
    let completion = Unimock::new((
        CompletionMock::handoff
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, _| calls.lock().unwrap().push("handoff")
            })),
        CompletionMock::metadata_bytes
            .each_call(matching!())
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_| {
                    calls.lock().unwrap().push("metadata");
                    0
                }
            })),
    ))
    .no_verify_in_drop();
    generation
        .render_background("custom", Arc::new(completion.clone()))
        .unwrap();
    assert_eq!(*calls.lock().unwrap(), ["render"]);
}
