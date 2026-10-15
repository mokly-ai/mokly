//! Mixed consumers use the core's typed catalogue, CSS, fragments, and cache.

use mokly_model::catalogue::EntryContent;
use mokly_model::controls::ControlInput;
use mokly_model::usage::{CatalogueUsage, ComponentRangeTarget};
use mokly_sidecar::methods::Call;

use super::support::Consumer;

#[test]
fn mixed_catalogue_renders_react_html_stories_pages_and_saved_slots() {
    let consumer = Consumer::new();
    let prepared = consumer.prepare().unwrap();
    assert!(prepared.deferred_modules.is_empty());
    assert_eq!(prepared.model.entries.len(), 8);
    assert_eq!(
        prepared.javascript.entries["components/chip"].handle,
        "specs/components/chip.mockup.tsx#chip"
    );
    assert_eq!(
        prepared
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "components/chip")
            .unwrap()
            .metadata
            .source
            .path,
        "library/chip.tsx"
    );
    let screen = prepared
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "screen")
        .unwrap();
    let EntryContent::Screen { visual, .. } = &screen.content else {
        panic!("screen")
    };
    assert_eq!(visual.prop_schema.required, Some(vec!["label".into()]));
    let story = prepared
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "story")
        .unwrap();
    let EntryContent::Component { visual, .. } = &story.content else {
        panic!("story component")
    };
    assert!(!visual.props.contains_key("onSelect"));
    assert!(
        visual.prop_schema.properties.as_ref().unwrap()["label"]
            .enumeration
            .is_none()
    );
    assert!(matches!(
        visual.controls["label"].input,
        ControlInput::Select { .. }
    ));
    assert_eq!(
        visual.controls["label"].label.as_deref(),
        Some("Story label")
    );
    assert_eq!(
        visual.controls["label"].description.as_deref(),
        Some("Choose a label")
    );
    assert!(prepared.warnings.is_empty());
    let generation = consumer.generation(prepared);
    assert!(
        !consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .any(|call| matches!(
                call,
                Call::RenderScreen(_)
                    | Call::RenderComponent(_)
                    | Call::RenderStory(_)
                    | Call::RenderPage(_)
            ))
    );
    let rendered = generation.render_all().unwrap();
    assert_eq!(rendered.documents, 29);
    assert!(rendered.warnings.is_empty(), "{:?}", rendered.warnings);
    assert!(rendered.closure.contains("assets/banner.svg"));
    let mixed = generation.render("mixed/index.mobile.html").unwrap();
    let html = String::from_utf8(mixed.bytes.clone()).unwrap();
    assert_slot_receivers(&html);
    let screen_bytes = generation.render("screen/index.mobile.html").unwrap();
    assert_slot_receivers(&String::from_utf8(screen_bytes.bytes.clone()).unwrap());
    assert!(html.contains("HTML child"));
    assert!(!html.contains("mokly-slot name="));
    assert!(html.contains("data-mokly-owners=\"components/chip\""));
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &mixed.document.as_ref().unwrap().usage
    else {
        panic!("usage")
    };
    assert_eq!(instances.len(), 1);
    assert_eq!(instances[0].component_id, "components/chip");
    assert_eq!(slots.len(), 1);
    assert!(
        ranges
            .iter()
            .any(|range| matches!(range.target, ComponentRangeTarget::Slot { .. }))
    );
    let variant = generation
        .render("components/chip/emphasis/index.desktop.dark.html")
        .unwrap();
    let html = String::from_utf8(variant.bytes.clone()).unwrap();
    assert!(html.contains("Saved child"));
    assert!(html.contains("data-entry=\"components/chip/emphasis\""));
    assert!(html.contains("data-title=\"Emphasis\""));
    assert!(html.contains("data-scheme=\"dark\""));
    let story = generation
        .render("story/Alternate/index.mobile.html")
        .unwrap();
    assert!(
        String::from_utf8(story.bytes.clone())
            .unwrap()
            .contains("Other: 4")
    );
    let page = generation.render("page/index.html").unwrap();
    assert!(
        String::from_utf8(page.bytes.clone())
            .unwrap()
            .contains("Page body")
    );
    let css = generation
        .resource("styles/specs/components/chip.mockup.tsx.css")
        .unwrap()
        .unwrap();
    let text = String::from_utf8(css).unwrap();
    assert!(text.contains("#639"), "{text}");
    let scoped = text
        .split('.')
        .nth(1)
        .unwrap()
        .split_whitespace()
        .next()
        .unwrap();
    assert!(scoped.starts_with("mokly_"));
    assert!(
        String::from_utf8(mixed.bytes.clone())
            .unwrap()
            .contains(scoped)
    );
    let requests = consumer.pool.calls.lock().unwrap();
    assert_eq!(
        requests
            .iter()
            .filter(|call| matches!(call, Call::ProcessCss(_)))
            .count(),
        2
    );
    let describe = requests
        .iter()
        .position(|call| matches!(call, Call::Describe(_)))
        .unwrap();
    let maps = requests
        .iter()
        .position(|call| matches!(call, Call::CssModules(_)))
        .unwrap();
    assert!(maps < describe);
}

fn assert_slot_receivers(html: &str) {
    let markers: Vec<_> = html.split("<!--mokly-slot:start ").skip(1).collect();
    assert!(!markers.is_empty(), "the built fixture must contain slots");
    for marker in markers {
        let attributes = marker.split_once("-->").unwrap().0;
        let receiver = attributes
            .split_once("instance=\"")
            .unwrap()
            .1
            .split('"')
            .next()
            .unwrap();
        assert!(receiver.starts_with("r-"), "{attributes}");
        assert!(
            html.contains(&format!("<!--mokly-instance:start id=\"{receiver}\"")),
            "{attributes}"
        );
    }
}
