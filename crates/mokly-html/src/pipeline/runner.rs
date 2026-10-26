//! Parse one input into a Mokly tree, and repair trees that hold an HTML `plaintext`.

use mokly_catalogue::html_driver::drive;
use mokly_catalogue::html_input::{HtmlInput, HtmlShape};
use mokly_model::catalogue::SourceLocation;

use super::locator::Locator;
use crate::html_arena::Arena;
use crate::serialize;
use crate::tree::{self, Node};

/// Parse authored or delivered HTML with the shared driver.
pub(crate) fn parse(input: HtmlInput<'_>) -> Vec<Node> {
    let shape = input.shape();
    match input {
        HtmlInput::Authored(html) => {
            let origin = html.origin();
            run(
                html.text(),
                shape,
                true,
                origin.map(|origin| origin.path),
                origin.map_or(1, |origin| origin.line),
                origin.map_or(1, |origin| origin.column),
            )
        }
        HtmlInput::Delivered(html) => run(html.text(), shape, false, None, 1, 1),
    }
}

fn run(
    source: &str,
    shape: HtmlShape,
    authored: bool,
    path: Option<&str>,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    let nodes = run_once(source, shape, authored, path, base_line, base_column);
    if !contains_plaintext(&nodes) {
        return nodes;
    }
    let positions = authored.then(|| positions_before_plaintext(&nodes));
    let mut repaired = run_once(&serialize::html(&nodes), shape, authored, path, 1, 1);
    if let Some(positions) = positions {
        copy_positions(&mut repaired, &positions);
    }
    repaired
}

fn run_once(
    source: &str,
    shape: HtmlShape,
    authored: bool,
    path: Option<&str>,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    let arena = match path.filter(|_| authored) {
        Some(path) => Arena::located(Locator::new(source, path, base_line, base_column)),
        None => Arena::new(authored),
    };
    let nodes = drive(source, shape, arena);
    if shape == HtmlShape::Fragment {
        nodes
            .into_iter()
            .flat_map(|mut node| match &mut node {
                Node::Element(element) if element.name == "html" => {
                    std::mem::take(&mut element.children)
                }
                _ => vec![node],
            })
            .collect()
    } else {
        nodes
    }
}

fn contains_plaintext(nodes: &[Node]) -> bool {
    tree::walk(nodes).any(|node| {
        matches!(node, Node::Element(element) if element.is_html() && element.name == "plaintext")
    })
}

fn positions_before_plaintext(nodes: &[Node]) -> Vec<(Option<SourceLocation>, Option<String>)> {
    let mut positions = Vec::new();
    for node in tree::walk(nodes) {
        let Node::Element(element) = node else {
            continue;
        };
        let plaintext = element.is_html() && element.name == "plaintext";
        positions.push((element.source.clone(), element.origin.clone()));
        if plaintext {
            break;
        }
    }
    positions
}

fn copy_positions(nodes: &mut [Node], positions: &[(Option<SourceLocation>, Option<String>)]) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    let mut index = 0;
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            if let Some((source, origin)) = positions.get(index) {
                element.source = source.clone();
                element.origin = origin.clone();
            }
            let stop = element.is_html() && element.name == "plaintext";
            index += 1;
            if stop {
                break;
            }
        }
        if let Some(children) = node.children_mut() {
            pending.extend(children.iter_mut().rev());
        }
    }
}
