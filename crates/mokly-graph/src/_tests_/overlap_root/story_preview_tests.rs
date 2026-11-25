//! Temporary props surface story failures and let the next render try again.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_catalogue::diagnostic::{STORY_RENDER_FAILED, Warning, WarningSubject};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{RenderMethod, RenderSource};
use mokly_html::error::HtmlError;
use mokly_html::fragment::{
    Fragment, FragmentRenderer, FragmentRendererMock, RenderKind, StoryRenderFailure,
};
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

pub(super) const ROUTE: &str = "caller/index.mobile.html";
const WARNING: &str = "story \"caller.stories.tsx#Default\" could not render; add the \"!mokly\" tag to leave it out: document is not defined";

pub(super) fn story_catalogue() -> PreparedCatalogue {
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
    catalogue
}

pub(super) fn failed_fragment() -> Fragment {
    Fragment {
        story_failure: Some(Box::new(StoryRenderFailure {
            story_id: "caller.stories.tsx#Default".into(),
            name: "Menu".into(),
            reason: "document is not defined".into(),
        })),
        ..Default::default()
    }
}

#[test]
fn a_failed_story_rejects_live_props_with_a_render_failure() {
    let renderer = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers(&|_, request| {
                assert_eq!(request.kind, RenderKind::Story);
                Ok(failed_fragment())
            }),
    );
    let (session, _) = session(
        story_catalogue(),
        Arc::new(renderer),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    let saved = session.render(ROUTE).unwrap();
    assert_eq!(
        saved.document.as_ref().unwrap().warnings,
        [Warning {
            code: STORY_RENDER_FAILED,
            subject: WarningSubject::Route(ROUTE.into()),
            message: WARNING.into(),
        }]
    );
    for open in [false, true] {
        let props = serde_json::from_value(json!({"open":open})).unwrap();
        let failure = session
            .render_props(ROUTE, &props)
            .err()
            .and_then(|error| match error {
                GraphError::Html {
                    source: HtmlError::Runtime { source },
                } => Some((source.code, source.message)),
                _ => None,
            });
        assert_eq!(
            failure,
            Some((RuntimeCode::Render, WARNING.into())),
            "open={open}"
        );
    }
}

fn fails_once_during_render() -> Arc<dyn FragmentRenderer> {
    let rendered = AtomicBool::new(false);
    Arc::new(Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                assert_eq!(request.kind, RenderKind::Story);
                if rendered.swap(true, Ordering::Relaxed) {
                    Ok(Fragment {
                        html: "<button>Ready</button>".into(),
                        ..Default::default()
                    })
                } else {
                    Ok(failed_fragment())
                }
            })),
    ))
}

#[test]
fn identical_live_props_render_again_after_a_story_failure() {
    let (session, _) = session(
        story_catalogue(),
        fails_once_during_render(),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    let props = serde_json::from_value(json!({"open":true})).unwrap();
    assert!(matches!(
        session.render_props(ROUTE, &props),
        Err(GraphError::Html {
            source: HtmlError::Runtime { source },
        }) if source.code == RuntimeCode::Render && source.message == WARNING
    ));
    let preview = session.render_props(ROUTE, &props).unwrap();
    assert!(String::from_utf8_lossy(&preview.artifact.bytes).contains("<button>Ready</button>"));
}

#[test]
fn live_saved_props_render_again_but_the_saved_view_keeps_its_warning() {
    let (session, _) = session(
        story_catalogue(),
        fails_once_during_render(),
        Arc::new(MemoryCache::new(1 << 20, 0)),
    );
    let saved = session.render(ROUTE).unwrap();
    assert_eq!(
        saved.document.as_ref().unwrap().warnings,
        [Warning {
            code: STORY_RENDER_FAILED,
            subject: WarningSubject::Route(ROUTE.into()),
            message: WARNING.into(),
        }]
    );
    let props = serde_json::from_value(json!({"open":false})).unwrap();
    let preview = session.render_props(ROUTE, &props).unwrap();
    assert!(String::from_utf8_lossy(&preview.artifact.bytes).contains("<button>Ready</button>"));
    let reused = session.render(ROUTE).unwrap();
    assert_eq!(
        reused.document.as_ref().unwrap().warnings,
        saved.document.as_ref().unwrap().warnings,
    );
}
