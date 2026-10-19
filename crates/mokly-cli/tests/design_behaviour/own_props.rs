//! Parent and first saved variant intentionally differ in link props.

use mokly_model::axes::Viewport;
use mokly_model::catalogue::EntryContent;
use mokly_model::data::DataValue;

use super::{catalogue, dom};

/// Check parent and variant destinations against their own declared data.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    for (path, tag) in [
        ("design/library/controls/tag-chip", "span"),
        ("design/library/controls/tag-chip/default", "a"),
    ] {
        let (index, entry) = fixture
            .generation
            .catalogue()
            .model
            .entries
            .iter()
            .enumerate()
            .find(|(_, entry)| entry.metadata.path == path)
            .unwrap();
        let EntryContent::Component { visual, .. } = &entry.content else {
            panic!("component")
        };
        let Some(DataValue::String(label)) = visual.props.get("label") else {
            panic!("label")
        };
        assert_eq!(
            visual.props.contains_key("destination"),
            tag == "a",
            "{path}"
        );
        for viewport in [Viewport::Mobile, Viewport::Desktop] {
            assert!(
                fixture
                    .generation
                    .plans()
                    .values()
                    .any(|plan| plan.entry == index && plan.viewport == Some(viewport)),
                "{path} {viewport:?}"
            );
        }
        for artifact in fixture.views(path) {
            let document = artifact.document.as_ref().unwrap();
            let chips = dom::class(&document.tree, "mbk-chip");
            assert_eq!(chips.len(), 1, "{path}");
            assert_eq!(chips[0].name, tag, "{path} uses its own destination");
            assert_eq!(dom::text(&chips[0].children), *label, "{path}");
            assert_eq!(chips[0].get("href").is_some(), tag == "a", "{path}");
        }
    }
}
