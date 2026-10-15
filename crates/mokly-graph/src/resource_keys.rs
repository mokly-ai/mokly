//! Hash statically reachable authored resources before a document render.

use std::collections::{BTreeSet, VecDeque};
use std::iter;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::{parse, props};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::data::{DataValue, Props};
use mokly_model::namespace;
use pulldown_cmark::{Event, Parser, Tag};

use crate::references;

pub(crate) fn seeds(
    catalogue: &PreparedCatalogue,
    entry: &ModelEntry,
    route: &str,
    components: &BTreeSet<String>,
) -> VecDeque<(String, String)> {
    let mut queue = VecDeque::new();
    let source = namespace::generated(route);
    let parent = entry
        .metadata
        .variant_of
        .as_ref()
        .unwrap_or(&entry.metadata.path);
    for path in iter::once(parent).chain(components) {
        if let Some(template) = catalogue.templates.get(path) {
            let body = if path == parent {
                match &entry.content {
                    EntryContent::Screen { visual, .. }
                    | EntryContent::Component { visual, .. } => {
                        props::substitute(&template.body, &visual.prop_schema, &visual.props)
                            .unwrap_or_else(|_| template.body.clone())
                    }
                    _ => template.body.clone(),
                }
            } else {
                template.body.clone()
            };
            for reference in references::collect(&parse::document(&body)) {
                queue.push_back((source.clone(), reference.url));
            }
        }
    }
    if let EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } =
        &entry.content
    {
        for text in strings(&visual.props) {
            queue.push_back((source.clone(), text));
        }
    }
    if let Some(body) = catalogue.documents.get(&entry.metadata.path) {
        for event in Parser::new(body) {
            if let Event::Start(Tag::Link { dest_url, .. } | Tag::Image { dest_url, .. }) = event {
                queue.push_back((
                    format!("static/{}", entry.metadata.source.path),
                    dest_url.into_string(),
                ));
            }
        }
    }
    queue
}

fn strings(props: &Props) -> Vec<String> {
    let mut output = Vec::new();
    let mut queue: Vec<_> = props.values().collect();
    while let Some(value) = queue.pop() {
        match value {
            DataValue::String(value) => output.push(value.clone()),
            DataValue::Object(props) => queue.extend(props.values()),
            DataValue::Array(values) => queue.extend(values),
            _ => {}
        }
    }
    output
}
