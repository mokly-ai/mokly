//! Experimental token-driven HTML5 parsing.

use std::convert::Infallible;

use html5ever::tendril::StrTendril;
use html5ever::tokenizer::{
    Doctype, Tag, TagKind, Token, TokenSink, TokenSinkResult, states::RawKind,
};
use html5ever::tree_builder::{TreeBuilder, TreeBuilderOpts};
use html5ever::{Attribute, QualName};
use html5gum::emitters::callback::{Callback, CallbackEmitter, CallbackEvent};
use html5gum::{Emitter, ForwardingEmitter, Span, State, Tokenizer};
use mokly_model::catalogue::SourceLocation;

use crate::html_arena::{Arena, Handle};
use crate::tree::Node;

/// Crate-internal switch for the differential harness and future migration.
pub(crate) const ENABLED: bool = false;

struct CallbackSink<'a> {
    builder: &'a mut TreeBuilder<Handle, Arena>,
    source: &'a str,
    source_path: &'a str,
    start_name: Option<String>,
    start_offset: usize,
    start_attributes: Vec<Attribute>,
    next_state: Option<State>,
}

impl<'a> CallbackSink<'a> {
    fn result(&mut self, result: TokenSinkResult<Handle>) -> Option<State> {
        let state = match result {
            TokenSinkResult::Continue | TokenSinkResult::EncodingIndicator(_) => None,
            TokenSinkResult::Script(_) => Some(State::Data),
            TokenSinkResult::Plaintext => Some(State::PlainText),
            TokenSinkResult::RawData(RawKind::Rcdata) => Some(State::RcData),
            TokenSinkResult::RawData(RawKind::Rawtext) => Some(State::RawText),
            TokenSinkResult::RawData(RawKind::ScriptData)
            | TokenSinkResult::RawData(RawKind::ScriptDataEscaped(_)) => Some(State::ScriptData),
        };
        self.next_state = state;
        state
    }

    fn send(&mut self, token: Token) -> Option<State> {
        let result = self
            .builder
            .process_token(token, self.line_number(self.start_offset));
        self.builder.sink.clear_active_source();
        self.result(result)
    }

    fn line_number(&self, offset: usize) -> u64 {
        self.source
            .char_indices()
            .take_while(|(index, _)| *index < offset)
            .filter(|(_, character)| *character == '\n')
            .count() as u64
            + 1
    }

    fn source_location(&self) -> SourceLocation {
        let mut line = 1;
        let mut column = 1;
        for (index, character) in self.source.char_indices() {
            if index >= self.start_offset {
                break;
            }
            if character == '\n' {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
        }
        SourceLocation {
            path: self.source_path.into(),
            line,
            column,
            export: None,
        }
    }
}

impl<'a> Callback<Infallible, usize> for CallbackSink<'a> {
    fn handle_event(&mut self, event: CallbackEvent<'_>, span: Span<usize>) -> Option<Infallible> {
        match event {
            CallbackEvent::OpenStartTag { name } => {
                self.start_name = Some(String::from_utf8_lossy(name).into_owned());
                self.start_offset = span.start;
                self.start_attributes.clear();
            }
            CallbackEvent::AttributeName { name } => {
                self.start_attributes.push(Attribute {
                    name: QualName::new(
                        None,
                        Default::default(),
                        String::from_utf8_lossy(name).into_owned().into(),
                    ),
                    value: StrTendril::new(),
                });
            }
            CallbackEvent::AttributeValue { value } => {
                if let Some(attribute) = self.start_attributes.last_mut() {
                    attribute.value.push_slice(&String::from_utf8_lossy(value));
                }
            }
            CallbackEvent::CloseStartTag { self_closing } => {
                let source = self.source_location();
                let element_name = self.start_name.clone().unwrap_or_default();
                self.builder.sink.set_active_source(element_name, source);
                let name = self.start_name.take().unwrap_or_default().into();
                let token = Token::TagToken(Tag {
                    kind: TagKind::StartTag,
                    name,
                    self_closing,
                    attrs: std::mem::take(&mut self.start_attributes),
                    had_duplicate_attributes: false,
                });
                let _ = self.send(token);
            }
            CallbackEvent::EndTag { name } => {
                let _ = self.send(Token::TagToken(Tag {
                    kind: TagKind::EndTag,
                    name: String::from_utf8_lossy(name).into_owned().into(),
                    self_closing: false,
                    attrs: Vec::new(),
                    had_duplicate_attributes: false,
                }));
            }
            CallbackEvent::String { value } => {
                let text = String::from_utf8_lossy(value);
                let mut parts = text.split('\0');
                if let Some(first) = parts.next()
                    && !first.is_empty()
                {
                    let _ = self.send(Token::CharacterTokens(first.into()));
                }
                for part in parts {
                    let _ = self.send(Token::NullCharacterToken);
                    if !part.is_empty() {
                        let _ = self.send(Token::CharacterTokens(part.into()));
                    }
                }
            }
            CallbackEvent::Comment { value } => {
                let _ = self.send(Token::CommentToken(
                    String::from_utf8_lossy(value).into_owned().into(),
                ));
            }
            CallbackEvent::Doctype {
                name,
                public_identifier,
                system_identifier,
                force_quirks,
            } => {
                let _ = self.send(Token::DoctypeToken(Doctype {
                    name: Some(String::from_utf8_lossy(name).into_owned().into()),
                    public_id: public_identifier
                        .map(|value| String::from_utf8_lossy(value).into_owned().into()),
                    system_id: system_identifier
                        .map(|value| String::from_utf8_lossy(value).into_owned().into()),
                    force_quirks,
                }));
            }
            CallbackEvent::Error(error) => {
                let _ = self.send(Token::ParseError(error.as_str().into()));
            }
        }
        None
    }
}

struct PipelineEmitter<'a> {
    inner: CallbackEmitter<CallbackSink<'a>, Infallible, usize>,
}

impl<'a> PipelineEmitter<'a> {
    fn new(builder: &'a mut TreeBuilder<Handle, Arena>, source: &'a str, path: &'a str) -> Self {
        Self {
            inner: CallbackEmitter::new(CallbackSink {
                builder,
                source,
                source_path: path,
                start_name: None,
                start_offset: 0,
                start_attributes: Vec::new(),
                next_state: None,
            }),
        }
    }
}

impl<'a> ForwardingEmitter for PipelineEmitter<'a> {
    type Token = Infallible;

    fn inner(&mut self) -> &mut impl Emitter<Token = Self::Token> {
        &mut self.inner
    }

    fn emit_eof(&mut self) {
        self.inner.emit_eof();
        let builder = &mut self.inner.callback_mut().builder;
        let _ = builder.process_token(Token::EOFToken, 1);
        builder.end();
    }

    fn emit_current_tag(&mut self) -> Option<State> {
        assert!(self.inner.emit_current_tag().is_none());
        self.inner.callback_mut().next_state.take()
    }

    fn adjusted_current_node_present_but_not_in_html_namespace(&mut self) -> bool {
        self.inner
            .callback_mut()
            .builder
            .adjusted_current_node_present_but_not_in_html_namespace()
    }
}

/// Parse a complete document through the experimental token-driven pipeline.
pub(crate) fn document(source: &str, path: &str) -> Vec<Node> {
    let mut builder = TreeBuilder::new(
        Arena::default(),
        TreeBuilderOpts {
            scripting_enabled: false,
            ..Default::default()
        },
    );
    let emitter = PipelineEmitter::new(&mut builder, source, path);
    let tokenizer = Tokenizer::new_with_emitter(source, emitter);
    match tokenizer.finish() {
        Ok(()) => {}
        Err(error) => match error {},
    }
    builder.sink.output()
}
