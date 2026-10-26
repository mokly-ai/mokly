//! Run the token emitter against a document or fragment tree builder.

use html5ever::tree_builder::{TreeBuilder, TreeBuilderOpts};
use html5ever::{QualName, local_name, ns};
use html5gum::Tokenizer;

use super::PipelineEmitter;
use crate::html_arena::Arena;
use crate::tree::Node;

pub(super) fn run(
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
