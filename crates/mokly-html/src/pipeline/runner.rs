//! Run the token emitter against a document or fragment tree builder.

use html5ever::tree_builder::{TreeBuilder, TreeBuilderOpts};
use html5ever::{QualName, local_name, ns};
use html5gum::Tokenizer;
use mokly_model::catalogue::SourceLocation;

use super::PipelineEmitter;
use crate::html_arena::Arena;
use crate::serialize;
use crate::tree::{self, Node};

pub(super) fn run(
    source: &str,
    fragment: bool,
    authored: bool,
    path: Option<&str>,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    let nodes = run_once(source, fragment, authored, path, base_line, base_column);
    if !contains_plaintext(&nodes) {
        return nodes;
    }
    let positions = authored.then(|| positions_before_plaintext(&nodes));
    let mut repaired = run_once(&serialize::html(&nodes), fragment, authored, path, 1, 1);
    if let Some(positions) = positions {
        copy_positions(&mut repaired, &positions);
    }
    repaired
}

fn run_once(
    source: &str,
    fragment: bool,
    authored: bool,
    path: Option<&str>,
    base_line: usize,
    base_column: usize,
) -> Vec<Node> {
    let source = source.strip_prefix('\u{feff}').unwrap_or(source);
    let arena = Arena::new(authored);
    let mut builder = if fragment {
        let context = arena.create(
            None,
            Some(QualName::new(None, ns!(html), local_name!("body"))),
        );
        TreeBuilder::new_for_fragment(
            arena,
            context,
            None,
            TreeBuilderOpts {
                scripting_enabled: false,
                ..Default::default()
            },
        )
    } else {
        TreeBuilder::new(
            arena,
            TreeBuilderOpts {
                scripting_enabled: false,
                ..Default::default()
            },
        )
    };
    let emitter =
        PipelineEmitter::new(&mut builder, source, path, base_line, base_column, authored);
    let tokenizer = Tokenizer::new_with_emitter(source, emitter);
    match tokenizer.finish() {
        Ok(()) => {}
        Err(error) => match error {},
    }
    let nodes = builder.sink.output();
    if fragment {
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
