//! Request builders and the call labels of a complete warm-up.

use std::collections::BTreeMap;

use crate::bindings::Bindings;
use crate::methods::{
    Bundle, BundleRequest, Call, ColorScheme, CssModules, ProcessCss, RenderPage, RenderStory,
};

use super::support::Event;

pub(super) fn call(process: usize, label: &str) -> Event {
    Event::Call(process, label.into())
}

pub(super) fn bundle(generation: &str) -> Call {
    Call::Bundle(BundleRequest {
        preparation: None,
        plan: None,
        params: Bundle {
            vite: false,
            vite_inputs: None,
            source_root: "/head".into(),
            configuration_directory: ".".into(),
            entry_files: vec![generation.into()],
            renderer: None,
            stories_files: vec![],
            repository_roots: vec![],
            module_resolution: Default::default(),
            evaluation: None,
        },
        capture: None,
    })
}

pub(super) fn maps(generation: &str) -> Call {
    Call::CssModules(CssModules {
        generation: generation.into(),
        named_exports: None,
        class_maps: BTreeMap::new(),
    })
}

pub(super) fn bindings(generation: &str) -> Call {
    Call::Bindings(Bindings {
        generation: generation.into(),
        entries: BTreeMap::new(),
    })
}

pub(super) fn render(generation: &str, view: &str) -> Call {
    Call::RenderPage(RenderPage {
        generation: generation.into(),
        handle: format!("{view}#default"),
    })
}

pub(super) fn story(generation: &str, name: &str) -> Call {
    Call::RenderStory(RenderStory {
        generation: generation.into(),
        story_id: format!("menu.stories.tsx#{name}"),
        props: BTreeMap::new(),
        viewport: "desktop".into(),
        color_scheme: ColorScheme::Light,
    })
}

pub(super) fn css(root: &str, context: &str) -> Call {
    Call::ProcessCss(ProcessCss {
        source_root: root.into(),
        context: context.into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
        postcss: "postcss.mjs".into(),
        source_path: "style.css".into(),
        text: String::new(),
    })
}

/// Views named `{prefix}-1` to `{prefix}-{count}`, in render order.
pub(super) fn views(prefix: &str, count: usize) -> Vec<String> {
    (1..=count).map(|view| format!("{prefix}-{view}")).collect()
}

/// The preparation calls that a process without the generation receives, in order.
pub(super) fn prepared(generation: &str) -> Vec<String> {
    vec![
        format!("restoreGeneration {generation}"),
        maps(generation).to_string(),
        format!("describe {generation}"),
        bindings(generation).to_string(),
    ]
}

/// The labels of the render calls of these views.
pub(super) fn replayed(generation: &str, views: &[String]) -> Vec<String> {
    views
        .iter()
        .map(|view| render(generation, view).to_string())
        .collect()
}
