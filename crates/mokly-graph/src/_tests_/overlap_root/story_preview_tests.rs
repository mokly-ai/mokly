//! Saved story failures remain failures on the temporary props route.

use std::sync::Arc;

use mokly_catalogue::diagnostic::{STORY_RENDER_FAILED, Warning, WarningSubject};
use mokly_catalogue::render_sources::{RenderMethod, RenderSource};
use mokly_html::error::HtmlError;
use mokly_html::fragment::{Fragment, FragmentRendererMock, RenderKind, StoryRenderFailure};
use mokly_model::catalogue::EntryContent;
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_model::validation::PropValidator;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::cache::MemoryCache;
use crate::error::GraphError;
use crate::types::RenderGeneration;

use super::support::{catalogue, session};

#[test]
fn a_failed_story_rejects_live_props_with_a_render_failure() {
    let mut catalogue = catalogue();
    catalogue.model.entries.truncate(1);
    let entry = &mut catalogue.model.entries[0];
    entry.metadata.source.path = "caller.stories.tsx".into();
    let schema = json!({"type":"object","properties":{"open":{"type":"boolean"}},"required":["open"],"additionalProperties":false});
    entry.content = EntryContent::Component {
        visual: serde_json::from_value(json!({
            "colorSchemes":["light"], "propSchema":schema, "props":{"open":false},
            "controls":{}, "controlOrder":["open"]
        }))
        .unwrap(),
        element: None,
        slots: vec![],
        supplied_slots: vec![],
    };
    catalogue.prop_validators.insert(
        "caller".into(),
        Arc::new(
            PropValidator::compile(
                &schema,
                &Context {
                    entry: "caller".into(),
                    variant: None,
                    kind: AuthoringKind::JavaScript,
                },
            )
            .unwrap(),
        ),
    );
    catalogue.javascript.entries.insert(
        "caller".into(),
        RenderSource {
            handle: "caller.stories.tsx#default".into(),
            method: RenderMethod::Story,
            ..Default::default()
        },
    );
    let renderer = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers(&|_, request| {
                assert_eq!(request.kind, RenderKind::Story);
                Ok(Fragment {
                    story_failure: Some(Box::new(StoryRenderFailure {
                        story_id: "caller.stories.tsx#Default".into(),
                        name: "Menu".into(),
                        reason: "document is not defined".into(),
                    })),
                    ..Default::default()
                })
            }),
    );
    let (session, _) = session(
        catalogue,
        Arc::new(renderer),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    let route = "caller/index.mobile.html";
    let saved = session.render(route).unwrap();
    let message = "story \"caller.stories.tsx#Default\" could not render; add the \"!mokly\" tag to leave it out: document is not defined";
    assert_eq!(
        saved.document.as_ref().unwrap().warnings,
        [Warning {
            code: STORY_RENDER_FAILED,
            subject: WarningSubject::Route(route.into()),
            message: message.into(),
        }]
    );
    for open in [false, true] {
        let props = serde_json::from_value(json!({"open":open})).unwrap();
        let failure = session
            .render_props(route, &props)
            .err()
            .and_then(|error| match error {
                GraphError::Html {
                    source: HtmlError::Runtime { source },
                } => Some((source.code, source.message)),
                _ => None,
            });
        assert_eq!(
            failure,
            Some((RuntimeCode::Render, message.into())),
            "open={open}"
        );
    }
}
