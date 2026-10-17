//! Registered implementation, caller input, variant, and temporary-props acceptance.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::catalogue::EntryContent;
use mokly_model::data::DataValue;

use super::native::Session;
use super::{edit, text};

pub const SCREEN_FILE: &str = "examples/basic/specs/attribution.mockup.tsx";
pub const SCREEN: &str = r#"
import { defineScreen } from '@mokly/mokly';
import { topBar } from './design/library/chrome/top-bar.js';
import { screenHeader } from './design/library/chrome/screen-header.js';
import { tagChip } from './design/library/controls/tag-chip.js';
import { changeStatusBadge } from './design/library/controls/change-status.js';
import { propField } from './design/library/inspector/prop-field.js';
import { metadataRow } from './design/library/inspector/metadata-row.js';
export default defineScreen({title:'Attribution caller',description:'',relatedDocs:[],colorSchemes:['light'],render:()=> <main>
  <topBar.Component moklyInstance='bar' {...topBar.props} query='QUERY_BEFORE' />
  <screenHeader.Component moklyInstance='header' {...screenHeader.props} title='TITLE_BEFORE' />
  <tagChip.Component moklyInstance='target' {...tagChip.props} destination='design/browse/views/home' />
  <changeStatusBadge.Component moklyInstance='status' status='unmodified' />
  <propField.Component moklyInstance='field' {...propField.props} control={<input defaultValue='VALUE_BEFORE' />} />
  <metadataRow.Component moklyInstance='slot' {...metadataRow.props}>SLOT_BEFORE</metadataRow.Component>
  {['first','second'].map(id => <tagChip.Component key={id} moklyInstance={id} {...tagChip.props} />)}
</main>});
"#;

pub fn changed(result: &ComparisonResult, expected: &[String]) {
    let mut actual = result.snapshot.changed_entries.clone();
    actual.sort();
    let mut expected = expected.to_vec();
    expected.sort();
    assert_eq!(actual, expected);
    assert_eq!(result.counts.changes, expected.len());
    let direct: BTreeSet<_> = result
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.clone())
        .collect();
    assert_eq!(direct, expected.into_iter().collect::<BTreeSet<_>>());
}

pub(super) fn no_resource_changes(result: &ComparisonResult) {
    for entry in &result.entries {
        for view in &entry.documents {
            assert!(view.evidence.rules.is_empty(), "{}", entry.path);
            assert!(view.evidence.resources.is_empty(), "{}", entry.path);
        }
    }
}

pub fn affected(result: &ComparisonResult, name: &str) {
    let records: BTreeSet<_> = result
        .review
        .affected
        .iter()
        .map(|record| {
            format!(
                "{} -> {}",
                record.changed_component_id, record.consumer.path
            )
        })
        .collect();
    assert!(!records.is_empty());
    assert!(result.review.affected.iter().all(
        |record| record.consumer.path.starts_with("design/")
            || record.consumer.path == "attribution"
            || record.consumer.path.starts_with("attribution-")
    ));
    insta::assert_snapshot!(name, records.into_iter().collect::<Vec<_>>().join("\n"));
}

pub fn run(root: &Path, session: &Session, baseline: &ComparisonResult) {
    for (name, file, needle, replacement, parent) in [
        (
            "top_bar_implementation",
            "chrome/top-bar.view.tsx",
            "<header className=\"mbk-topbar\">",
            "<header className=\"mbk-topbar\" data-m9-implementation=\"changed\">",
            "design/library/chrome/top-bar",
        ),
        (
            "nested_tag_chip_implementation",
            "controls/tag-chip.view.tsx",
            "className={className}",
            "className={className} data-m9-implementation=\"changed\"",
            "design/library/controls/tag-chip",
        ),
    ] {
        let path = format!("examples/basic/specs/design/library/{file}");
        let source = text(root, &path);
        assert!(source.contains(needle));
        let expected: Vec<_> = baseline
            .entries
            .iter()
            .filter(|entry| entry.path == parent || entry.path.starts_with(&format!("{parent}/")))
            .map(|entry| entry.path.clone())
            .collect();
        edit(
            root,
            session,
            name,
            &[(path.as_str(), source.replace(needle, replacement))],
            &|result| {
                changed(result, &expected);
                no_resource_changes(result);
                affected(result, name);
                if name.starts_with("nested") {
                    for consumer in [
                        "design/library/controls/tag-picker",
                        "design/library/chrome/top-bar",
                        "design/browse/views/screen/tag-picker",
                    ] {
                        assert!(
                            result
                                .review
                                .affected
                                .iter()
                                .any(|record| record.consumer.path == consumer)
                        );
                    }
                }
            },
        );
    }
    super::callers::run(root, session);
    let path = "examples/basic/specs/design/library/controls/tag-chip.tsx";
    let original = text(root, path);
    let needle = "label: \"onboarding\"";
    assert_eq!(original.matches(needle).count(), 1);
    edit(
        root,
        session,
        "variant props",
        &[(path, original.replace(needle, "label: \"changed variant\""))],
        &|result| {
            changed(
                result,
                &["design/library/controls/tag-chip/inactive".into()],
            );
            assert!(result.review.affected.is_empty());
        },
    );
}

pub fn temporary(result: &ComparisonResult) {
    let generation = &result.after;
    let (index, entry) = generation
        .catalogue()
        .model
        .entries
        .iter()
        .enumerate()
        .find(|(_, entry)| entry.metadata.path == "design/library/chrome/top-bar")
        .unwrap();
    let EntryContent::Component { visual, .. } = &entry.content else {
        panic!("component")
    };
    let route = &generation
        .plans()
        .values()
        .find(|plan| plan.entry == index)
        .unwrap()
        .route;
    let saved = generation.render(route).unwrap();
    let mut props = visual.props.clone();
    props.insert("query".into(), DataValue::String("temporary query".into()));
    let preview = generation.render_props(route, &props).unwrap();
    assert_ne!(preview.artifact.bytes, saved.bytes);
    assert_eq!(generation.render(route).unwrap().bytes, saved.bytes);
    let reset = generation.render_props(route, &visual.props).unwrap();
    assert_eq!(reset.artifact.bytes, saved.bytes);
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.review.affected.is_empty());
}
