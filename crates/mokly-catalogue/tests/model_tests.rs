//! Complete metadata inheritance and parent-error behavior after preparation.

use mokly_catalogue::error::CatalogueError;
use mokly_model::catalogue::EntryContent;
use serde_json::{Value, json};
use tempfile::TempDir;

mod support;

#[test]
fn variants_replace_props_inherit_metadata_and_do_not_inherit_flow_membership() {
    let directory = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "mokly.config.json",
        r#"{"colorSchemes":["light","dark"]}"#,
    );
    support::write(
        directory.path(),
        "specs/home.screen.html",
        r#"---
title: Home
description: Parent description
tags: [parent]
address: /home
relatedDocs: [notes.md]
movedFrom: old-home
colorSchemes: [light]
useCasePaths: [tour]
props: {user: {name: Ada, plan: pro}, count: 1}
variants:
  - slug: empty
    title: Empty
    props: {user: {name: Bob}, state: empty}
  - slug: dark
    title: Dark
    description: ""
    tags: []
    colorSchemes: [dark, light]
    props: {}
---
<h1>{{user.name}} {{state}}</h1><p>{{count}}</p>
"#,
    );
    support::write(
        directory.path(),
        "specs/tour.use-case.yaml",
        "title: Tour\nsteps: [{screenPath: home}]\n",
    );
    let prepared = support::prepare(directory.path(), Some("mokly.config.json")).unwrap();
    assert_eq!(
        prepared
            .model
            .entries
            .iter()
            .map(|entry| entry.metadata.path.as_str())
            .collect::<Vec<_>>(),
        ["home", "home/empty", "home/dark", "tour"]
    );
    let parent = &prepared.model.entries[0];
    let child = &prepared.model.entries[1];
    let dark = &prepared.model.entries[2];
    assert_eq!(child.metadata.description, parent.metadata.description);
    assert_eq!(child.metadata.tags, parent.metadata.tags);
    assert_eq!(child.metadata.related_docs, parent.metadata.related_docs);
    assert_eq!(child.metadata.moved_from, None);
    assert_eq!(dark.metadata.description, "");
    assert!(dark.metadata.tags.is_empty());
    let EntryContent::Screen {
        visual,
        address,
        use_case_paths,
    } = &child.content
    else {
        panic!()
    };
    assert_eq!(address.as_deref(), Some("/home"));
    assert!(use_case_paths.is_empty());
    assert_eq!(
        serde_json::to_value(&visual.props).unwrap(),
        json!({"user":{"name":"Bob"},"count":1,"state":"empty"})
    );
    let schema = serde_json::to_value(&visual.prop_schema).unwrap();
    assert_eq!(schema["required"], json!(["count", "user"]));
    assert_eq!(schema["properties"]["user"]["required"], json!(["name"]));
    assert_eq!(visual.color_schemes.len(), 1);
    let EntryContent::Screen { visual, .. } = &dark.content else {
        panic!()
    };
    assert_eq!(visual.color_schemes.len(), 2);
    let canonical = mokly_model::canonical::to_string(&prepared.model).unwrap();
    assert!(canonical.ends_with('\n'));
    assert_eq!(
        serde_json::from_str::<Value>(&canonical).unwrap()["entries"]
            .as_array()
            .unwrap()
            .len(),
        4
    );
}

#[test]
fn invalid_component_parent_reports_its_root_cause_before_its_children() {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    support::write(
        directory.path(),
        "specs/action.component.html",
        r#"---
title: Action
element: ui-action
propSchema:
  type: object
  additionalProperties: false
  properties: {label: {type: string}}
props: {label: 42}
variants:
  - {slug: bad, title: Bad, props: {}, path: forbidden}
---
<button>{{label}}</button>
"#,
    );
    let CatalogueError::Invalid { issues, .. } =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_str(), "html-attribute");
    assert_eq!(issues[0].location.as_ref().unwrap().line, 8);
}
