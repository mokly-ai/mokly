//! A synchronous custom generation retains its ordinary worker for the whole render.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::cache::Artifact;
use crate::types::{RenderGeneration, RenderGenerationMock};

#[test]
fn custom_generation_declines_lookup_without_rendering_or_completion_admission() {
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
    assert!(generation.read_background("custom").unwrap().is_none());
    assert_eq!(*calls.lock().unwrap(), Vec::<&str>::new());
    generation.render("custom").unwrap();
    assert_eq!(*calls.lock().unwrap(), ["render"]);
}
