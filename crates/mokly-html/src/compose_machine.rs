//! Iterative native composition and foreign placeholder expansion.

use std::sync::Arc;
use std::vec::IntoIter;

use mokly_model::catalogue::SourceLocation;
use tracing::Span;
use tracing::span::EnteredSpan;

use crate::composition::Engine;
use crate::context::Context;
use crate::error::{HtmlError, Result};
use crate::expansion::{After, Expansion, Mode};
use crate::tree::{self, Node, RegionKind};
use crate::{compose_finish, props};

pub(crate) struct Output {
    pub(crate) nodes: Vec<Node>,
    pub(crate) ownership: bool,
}

impl Output {
    fn append(&mut self, other: Self) {
        self.nodes.extend(other.nodes);
        self.ownership |= other.ownership;
    }
}

struct Frame {
    remaining: IntoIter<Node>,
    output: Output,
    context: Arc<Context>,
    mode: Mode,
    after: Vec<After>,
    location: Option<SourceLocation>,
    entered: Option<EnteredSpan>,
    span: Option<Span>,
}

#[derive(Default)]
struct Frames {
    items: Vec<Frame>,
}

impl Frames {
    fn push(&mut self, expansion: Expansion) {
        self.items.push(Frame {
            remaining: expansion.nodes.into_iter(),
            output: Output {
                nodes: Vec::new(),
                ownership: false,
            },
            context: expansion.context,
            mode: expansion.mode,
            after: expansion.after,
            location: expansion.location,
            entered: expansion.span.clone().map(|span| span.entered()),
            span: expansion.span,
        });
    }

    fn located(&self, error: HtmlError, location: Option<SourceLocation>) -> HtmlError {
        for frame in self.items.iter().rev() {
            if let Some(span) = &frame.span {
                tracing::error!(parent: span, error = %error);
            }
        }
        match location.or_else(|| {
            self.items
                .iter()
                .rev()
                .find_map(|frame| frame.location.clone())
        }) {
            Some(location) => error.at(location),
            None => error,
        }
    }
}

impl Drop for Frames {
    fn drop(&mut self) {
        while self.items.pop().is_some() {}
    }
}

impl Engine<'_> {
    pub(crate) fn expand(&mut self, expansion: Expansion) -> Result<Vec<Node>> {
        let mut frames = Frames::default();
        frames.push(expansion);
        while let Some(frame) = frames.items.last_mut() {
            if let Some(node) = frame.remaining.next() {
                if matches!(frame.mode, Mode::Ready) {
                    frame.output.ownership |= ownership(&node);
                    frame.output.nodes.push(node);
                    continue;
                }
                let prepared = self.prepare_node(node, frame.context.clone(), frame.mode.clone());
                match prepared {
                    Ok(expansion) => frames.push(expansion),
                    Err(error) => return Err(frames.located(error, None)),
                }
                continue;
            }
            if let Some(frame) = frames.items.pop() {
                let _entered = frame.entered;
                let location = frame.location;
                let span = frame.span;
                let completed =
                    compose_finish::finish(self, frame.output, frame.after, frame.context);
                match completed {
                    Err(error) => {
                        if let Some(span) = span {
                            tracing::error!(parent: &span, error = %error);
                        }
                        return Err(frames.located(error, location));
                    }
                    Ok(compose_finish::Completed::Expand(mut expansion)) => {
                        expansion.location = location;
                        frames.push(expansion);
                    }
                    Ok(compose_finish::Completed::Output(output)) => {
                        if let Some(parent) = frames.items.last_mut() {
                            parent.output.append(output);
                        } else {
                            return Ok(output.nodes);
                        }
                    }
                }
            }
        }
        Ok(Vec::new())
    }

    fn prepare_node(
        &mut self,
        mut node: Node,
        context: Arc<Context>,
        mode: Mode,
    ) -> Result<Expansion> {
        if let Mode::Foreign(placeholders) = mode {
            return self.foreign_node(node, context, placeholders);
        }
        if let Some(element) = node.take_element() {
            let location = element
                .source
                .clone()
                .unwrap_or_else(|| context.source.clone());
            return match self.element(element, context) {
                Ok(mut expansion) => {
                    expansion.location = Some(location);
                    Ok(expansion)
                }
                Err(error) => Err(error.at(location)),
            };
        }
        match &node {
            Node::Text(text) => {
                let text = if context.raw_text {
                    props::substitute_raw(text, &context.schema, &context.props)?
                } else {
                    props::substitute(text, &context.schema, &context.props)?
                };
                Ok(Expansion::ready(vec![Node::Text(text)], context))
            }
            Node::Comment(text) if text.trim_start().starts_with("mokly-") => {
                Ok(Expansion::ready(Vec::new(), context))
            }
            _ => Ok(Expansion::ready(vec![node], context)),
        }
    }
}

pub(crate) fn ownership(node: &Node) -> bool {
    tree::walk(std::slice::from_ref(node)).any(|node| {
        matches!(node,
        Node::Region { region, .. }
        if matches!(region.kind, RegionKind::Instance { .. } | RegionKind::Slot { .. }))
    })
}
