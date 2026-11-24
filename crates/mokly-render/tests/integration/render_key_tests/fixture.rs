//! Shared fixtures and observations for document render keys.

use std::collections::{BTreeMap, BTreeSet};

use mokly_sidecar::methods::Call;

use super::super::support::Consumer;

/// The render keys fixture, with a dependency that only component C imports.
///
/// The test writes the root manifest, because a tracked package manifest would join
/// the repository's dependency identity and give Changes a base installation.
pub(in super::super) fn consumer() -> Consumer {
    let consumer = Consumer::fixture("render-keys");
    consumer.write(
        "package.json",
        "{\n  \"name\": \"render-keys-fixture\",\n  \"private\": true\n}\n",
    );
    dependency(&consumer, "1.0.0", "dep-1");
    consumer
}

pub(in super::super) fn dependency(consumer: &Consumer, version: &str, value: &str) {
    consumer.write(
        "specs/node_modules/dep/package.json",
        &format!(r#"{{ "name": "dep", "version": "{version}", "main": "index.js" }}"#),
    );
    consumer.write(
        "specs/node_modules/dep/index.js",
        &format!("exports.dep = \"{value}\";\n"),
    );
}

/// Every document key of a fresh preparation, by entry path and view.
pub(in super::super) fn keys(consumer: &Consumer) -> BTreeMap<String, String> {
    let generation = consumer.generation(consumer.prepare().unwrap());
    generation
        .plans()
        .iter()
        .map(|(route, plan)| (route.clone(), plan.key.0.clone()))
        .collect()
}

/// The entries with a view whose key changed, appeared, or disappeared.
pub(in super::super) fn moved(
    before: &BTreeMap<String, String>,
    after: &BTreeMap<String, String>,
) -> BTreeSet<String> {
    let routes: BTreeSet<_> = before.keys().chain(after.keys()).collect();
    routes
        .into_iter()
        .filter(|route| before.get(*route) != after.get(*route))
        .map(|route| route.rsplit_once("/index.").unwrap().0.to_owned())
        .collect()
}

pub(in super::super) fn render_calls(consumer: &Consumer) -> Vec<(String, String)> {
    consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::RenderScreen(render) => {
                Some((render.entry.path.clone(), render.viewport.clone()))
            }
            Call::RenderComponent(render) => Some((
                render.render.entry.path.clone(),
                render.render.viewport.clone(),
            )),
            Call::RenderStory(render) => Some((render.story_id.clone(), render.viewport.clone())),
            Call::RenderPage(render) => Some((render.handle.clone(), String::new())),
            _ => None,
        })
        .collect()
}
