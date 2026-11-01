//! Drive the html5ever tree builder with html5gum tokens.
//!
//! The tree builder chooses every tokenizer state, so the catalogue checks and the Mokly tree
//! read one token stream. html5ever's `TreeBuilder` is generic over its sink, so the driver is
//! generic too.

use html5ever::tree_builder::{ElementFlags, TreeBuilder, TreeBuilderOpts, TreeSink};
use html5ever::{QualName, local_name, ns};
use html5gum::Tokenizer;

use crate::html_driver_emitter::DriverEmitter;
use crate::html_input::HtmlShape;
use crate::html_token_types::Token;

/// A tree sink that sees each token before the tree builder reads it.
pub trait DriverSink: TreeSink {
    /// Receives one token before the tree builder reads it. Spans are byte offsets in the
    /// driven text.
    fn before_token(&self, token: &Token);

    /// Runs after the tree builder has read the token.
    fn after_token(&self);
}

/// Parse `text` as a document or as a fragment in a `body` element, and return the sink output.
///
/// The parse disables scripting. It drops one leading byte order mark, as html5ever does, and
/// keeps every span relative to `text`.
pub fn drive<Sink: DriverSink>(text: &str, shape: HtmlShape, sink: Sink) -> Sink::Output {
    let opts = TreeBuilderOpts {
        scripting_enabled: false,
        ..Default::default()
    };
    let builder = match shape {
        HtmlShape::Document => TreeBuilder::new(sink, opts),
        HtmlShape::Fragment => {
            let body = QualName::new(None, ns!(html), local_name!("body"));
            let context = sink.create_element(body, Vec::new(), ElementFlags::default());
            TreeBuilder::new_for_fragment(sink, context, None, opts)
        }
    };
    let offset = if text.starts_with('\u{feff}') {
        '\u{feff}'.len_utf8()
    } else {
        0
    };
    let emitter = DriverEmitter::new(&builder, text, offset);
    match Tokenizer::new_with_emitter(&text[offset..], emitter).finish() {
        Ok(()) => {}
        Err(error) => match error {},
    }
    builder.sink.finish()
}
