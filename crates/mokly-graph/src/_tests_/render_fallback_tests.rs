use std::collections::BTreeMap;

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};

use super::{RenderInputs, RenderKeys};
use crate::key::{NodeKey, NodeKind, key};

const SCREEN: &str = "specs/screen.mockup.tsx";
const STORIES: &str = "specs/label.stories.tsx";

fn fallback() -> NodeKey {
    key(NodeKind::RenderInputs, &[b"whole bundle"])
}

/// A screen, a stories file, a renderer, and a preview that the graph names.
fn keys(renderer: &str, resolution: &[(&str, &str)]) -> RenderKeys {
    let generation = JavaScriptGeneration {
        modules: [SCREEN, STORIES, "renderer.tsx", ".storybook/preview.tsx"]
            .into_iter()
            .map(|path| (path.to_owned(), Vec::new()))
            .collect(),
        resolution_digests: resolution
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect(),
        ..JavaScriptGeneration::default()
    };
    let bindings = [SCREEN, STORIES]
        .into_iter()
        .map(|module| {
            (
                format!("{module}#default"),
                ResolvedDefinition {
                    path: module.into(),
                    title: module.into(),
                },
            )
        })
        .collect();
    let entries = BTreeMap::from([(
        "label".to_owned(),
        RenderSource {
            handle: format!("{STORIES}#default"),
            method: RenderMethod::Story,
            ..RenderSource::default()
        },
    )]);
    RenderKeys::build(
        &RenderInputs {
            generation: &generation,
            bindings: &bindings,
            renderer: Some(renderer),
            entries: &entries,
            declarations: &BTreeMap::new(),
        },
        fallback(),
    )
    .unwrap()
}

#[test]
fn a_renderer_that_the_graph_does_not_name_gives_non_story_modules_the_fallback() {
    let named = keys("renderer.tsx", &[]);
    assert_ne!(named.module(SCREEN), &fallback());
    let unnamed = keys("app/../renderer.tsx", &[]);
    assert_eq!(unnamed.module(SCREEN), &fallback());
    assert_ne!(unnamed.module(STORIES), &fallback());
    assert_eq!(unnamed.module(STORIES), named.module(STORIES));
}

#[test]
fn a_preview_that_the_graph_does_not_name_gives_stories_the_fallback() {
    let named = keys("renderer.tsx", &[]);
    assert_ne!(named.module(STORIES), &fallback());
    let unnamed = keys("renderer.tsx", &[(".storybook/preview.tsx", "preview")]);
    assert_eq!(unnamed.module(STORIES), &fallback());
    assert_ne!(unnamed.module(SCREEN), &fallback());
}
