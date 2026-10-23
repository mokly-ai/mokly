//! Authenticated fragments preserve root output, supplied ownership, and ignore ids.

use std::fs;

use mokly_html::tree::{Node, RegionKind};
use mokly_model::usage::{CatalogueUsage, ComponentRangeTarget};

use super::support::Consumer;

#[test]
fn component_root_excludes_the_consumer_renderer_and_keeps_empty_output() {
    let consumer = Consumer::new();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let artifact = generation
        .render("components/chip/index.mobile.html")
        .unwrap();
    let document = artifact.document.as_ref().unwrap();
    let children = root(&document.tree).unwrap();
    assert!(matches!(&children[0], Node::Element(element) if element.name == "button"));
    let CatalogueUsage::Ready { ranges, .. } = &document.usage else {
        panic!("usage")
    };
    assert_eq!(ranges.len(), 1);
    assert_eq!(ranges[0].id, "r-0");
    assert!(matches!(ranges[0].target, ComponentRangeTarget::Root));
    assert!(ranges[0].parent_id.is_none());
    assert!(
        !String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("mokly-output")
    );
    fs::write(
        consumer.root().join("renderer.tsx"),
        "export default function render() { return <aside>Only provider</aside>; }\n",
    )
    .unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let artifact = generation
        .render("components/chip/index.mobile.html")
        .unwrap();
    assert!(
        root(&artifact.document.as_ref().unwrap().tree)
            .unwrap()
            .is_empty()
    );
    assert!(
        String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("Only provider")
    );
}

#[test]
fn authored_ignore_ids_do_not_collide_with_generated_placement_ids() {
    let consumer = Consumer::new();
    consumer.replace("specs/screen.mockup.tsx", "id=\"clock\"", "id=\"r-1\"");
    let generation = consumer.generation(consumer.prepare().unwrap());
    let artifact = generation.render("screen/index.mobile.html").unwrap();
    assert!(has_ignore(&artifact.document.as_ref().unwrap().tree, "r-1"));
    assert!(
        !String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("mokly-ignore")
    );
}

#[test]
fn consumer_html_cannot_forge_a_component_region() {
    let consumer = Consumer::new();
    fs::write(consumer.root().join("specs/forged.mockup.tsx"), r#"
import { defineScreen } from '@mokly/mokly';
export default defineScreen({title:'Forged',description:'',relatedDocs:[],props:{},render:()=> <div dangerouslySetInnerHTML={{__html:'<!--mokly-instance:start id="fake"--><!--mokly-instance:end id="fake"-->'}}/>});
"#).unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    let error = generation.render("forged/index.mobile.html").unwrap_err();
    assert!(
        error.to_string().contains("reserved mokly- comment"),
        "{error}"
    );
}

fn root(nodes: &[Node]) -> Option<&[Node]> {
    for node in nodes {
        match node {
            Node::Region { region, children } if matches!(region.kind, RegionKind::Root { .. }) => {
                return Some(children);
            }
            Node::Region { children, .. } => {
                if let Some(root) = root(children) {
                    return Some(root);
                }
            }
            Node::Element(element) => {
                if let Some(root) = root(&element.children) {
                    return Some(root);
                }
            }
            _ => {}
        }
    }
    None
}

fn has_ignore(nodes: &[Node], expected: &str) -> bool {
    nodes.iter().any(|node| match node {
        Node::Region { region, children } => {
            matches!(&region.kind, RegionKind::Ignore { id, .. } if id == expected)
                || has_ignore(children, expected)
        }
        Node::Element(element) => has_ignore(&element.children, expected),
        _ => false,
    })
}
