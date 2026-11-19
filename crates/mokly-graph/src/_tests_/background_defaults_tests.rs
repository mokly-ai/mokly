//! A synchronous custom generation enters completion before its ordinary render.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::Artifact;
use crate::types::{RenderGeneration, RenderGenerationMock};

#[test]
fn custom_generation_default_enters_completion_before_render_and_never_hands_off() {
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
    let completion = Unimock::new(CompletionMock::enter.each_call(matching!()).answers_arc(
        Arc::new({
            let calls = calls.clone();
            move |_| calls.lock().unwrap().push("completion")
        }),
    ))
    .no_verify_in_drop();
    generation
        .render_background("custom", Arc::new(completion.clone()))
        .unwrap();
    assert_eq!(*calls.lock().unwrap(), ["completion", "render"]);
}
