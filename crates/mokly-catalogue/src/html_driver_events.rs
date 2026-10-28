//! Turn each html5gum event into one Mokly token and the matching html5ever tokens.

use std::collections::BTreeMap;
use std::convert::Infallible;
use std::mem;

use html5ever::tendril::StrTendril;
use html5ever::tokenizer::states::RawKind;
use html5ever::tokenizer::{self, TagKind, TokenSink, TokenSinkResult};
use html5ever::tree_builder::TreeBuilder;
use html5ever::{Attribute, QualName};
use html5gum::emitters::callback::{Callback, CallbackEmitter, CallbackEvent};
use html5gum::{Emitter, ForwardingEmitter, State};

use crate::html_driver::DriverSink;
use crate::html_token_types::{Doctype, EndTag, Error, ErrorToken, Span, Spanned, StartTag, Token};

/// The start tag that html5gum is still reading.
#[derive(Default)]
struct OpenTag {
    name: Vec<u8>,
    start: usize,
    token_attributes: BTreeMap<Vec<u8>, Spanned>,
    tree_attributes: Vec<Attribute>,
    current: Option<Vec<u8>>,
    duplicates: bool,
}

/// Sends each event to the sink hooks and to the tree builder, in source order.
pub(crate) struct EventSink<'a, Sink: DriverSink> {
    builder: &'a TreeBuilder<Sink::Handle, Sink>,
    offset: usize,
    tag: OpenTag,
    next_state: Option<State>,
}

impl<Sink: DriverSink> EventSink<'_, Sink> {
    fn span(&self, span: html5gum::Span<usize>) -> Span {
        Span {
            start: span.start + self.offset,
            end: span.end + self.offset,
        }
    }

    fn send(&mut self, token: &Token, tree_tokens: Vec<tokenizer::Token>) {
        self.builder.sink.before_token(token);
        for tree_token in tree_tokens {
            let result = self.builder.process_token(tree_token, 1);
            self.next_state = requested_state(result);
        }
        self.builder.sink.after_token();
    }

    fn attribute_name(&mut self, name: &[u8], span: Span) {
        if self.tag.token_attributes.contains_key(name) {
            self.tag.current = None;
            self.tag.duplicates = true;
            let error = Token::Error(ErrorToken {
                value: Error::DuplicateAttribute,
                span,
            });
            self.send(&error, Vec::new());
            return;
        }
        let value = Spanned {
            value: Vec::new(),
            span,
        };
        self.tag.token_attributes.insert(name.to_vec(), value);
        self.tag.tree_attributes.push(Attribute {
            name: QualName::new(None, Default::default(), text(name).into()),
            value: StrTendril::new(),
        });
        self.tag.current = Some(name.to_vec());
    }

    fn attribute_value(&mut self, value: &[u8], end: usize) {
        let Some(name) = &self.tag.current else {
            return;
        };
        if let Some(attribute) = self.tag.token_attributes.get_mut(name) {
            attribute.value.extend_from_slice(value);
            attribute.span.end = end + 1;
        }
        if let Some(attribute) = self.tag.tree_attributes.last_mut() {
            attribute.value.push_slice(&text(value));
        }
    }

    fn close_start_tag(&mut self, self_closing: bool, end: usize) {
        let tag = mem::take(&mut self.tag);
        let token = Token::StartTag(StartTag {
            name: tag.name.clone(),
            attributes: tag.token_attributes,
            self_closing,
            span: Span {
                start: tag.start,
                end,
            },
        });
        let tree_token = tokenizer::TagToken(tokenizer::Tag {
            kind: TagKind::StartTag,
            name: text(&tag.name).into(),
            self_closing,
            attrs: tag.tree_attributes,
            had_duplicate_attributes: tag.duplicates,
        });
        self.send(&token, vec![tree_token]);
    }

    fn end_tag(&mut self, name: &[u8], span: Span) {
        self.tag = OpenTag::default();
        let token = Token::EndTag(EndTag {
            name: name.to_vec(),
            span,
        });
        let tree_token = tokenizer::TagToken(tokenizer::Tag {
            kind: TagKind::EndTag,
            name: text(name).into(),
            self_closing: false,
            attrs: Vec::new(),
            had_duplicate_attributes: false,
        });
        self.send(&token, vec![tree_token]);
    }

    fn string(&mut self, value: &[u8], span: Span) {
        let mut tree_tokens = Vec::new();
        for (index, part) in text(value).split('\0').enumerate() {
            if index > 0 {
                tree_tokens.push(tokenizer::NullCharacterToken);
            }
            if !part.is_empty() {
                tree_tokens.push(tokenizer::CharacterTokens(part.into()));
            }
        }
        let token = Token::String(Spanned {
            value: value.to_vec(),
            span,
        });
        self.send(&token, tree_tokens);
    }
}

impl<Sink: DriverSink> Callback<Infallible, usize> for EventSink<'_, Sink> {
    fn handle_event(
        &mut self,
        event: CallbackEvent<'_>,
        span: html5gum::Span<usize>,
    ) -> Option<Infallible> {
        let span = self.span(span);
        match event {
            CallbackEvent::OpenStartTag { name } => {
                self.tag.name = name.to_vec();
                self.tag.start = span.start;
            }
            CallbackEvent::AttributeName { name } => self.attribute_name(name, span),
            CallbackEvent::AttributeValue { value } => self.attribute_value(value, span.end),
            CallbackEvent::CloseStartTag { self_closing } => {
                self.close_start_tag(self_closing, span.end);
            }
            CallbackEvent::EndTag { name } => self.end_tag(name, span),
            CallbackEvent::String { value } => self.string(value, span),
            CallbackEvent::Comment { value } => {
                let token = Token::Comment(Spanned {
                    value: value.to_vec(),
                    span,
                });
                self.send(&token, vec![tokenizer::CommentToken(text(value).into())]);
            }
            CallbackEvent::Doctype {
                name,
                public_identifier,
                system_identifier,
                force_quirks,
            } => {
                let token = Token::Doctype(Doctype {
                    name: Some(name.to_vec()),
                    public_identifier: public_identifier.map(<[u8]>::to_vec),
                    system_identifier: system_identifier.map(<[u8]>::to_vec),
                    force_quirks,
                    span,
                });
                let tree_token = tokenizer::DoctypeToken(tokenizer::Doctype {
                    name: Some(text(name).into()),
                    public_id: public_identifier.map(|value| text(value).into()),
                    system_id: system_identifier.map(|value| text(value).into()),
                    force_quirks,
                });
                self.send(&token, vec![tree_token]);
            }
            CallbackEvent::Error(error) => {
                let token = Token::Error(ErrorToken {
                    value: Error::Other(format!("{error:?}")),
                    span,
                });
                self.send(&token, vec![tokenizer::ParseError(error.as_str().into())]);
            }
        }
        None
    }
}

/// The html5gum emitter that lets the tree builder choose each tokenizer state.
pub(crate) struct DriverEmitter<'a, Sink: DriverSink> {
    inner: CallbackEmitter<EventSink<'a, Sink>, Infallible, usize>,
    cdata: bool,
}

impl<'a, Sink: DriverSink> DriverEmitter<'a, Sink> {
    pub(crate) fn new(builder: &'a TreeBuilder<Sink::Handle, Sink>, offset: usize) -> Self {
        Self {
            inner: CallbackEmitter::new(EventSink {
                builder,
                offset,
                tag: OpenTag::default(),
                next_state: None,
            }),
            cdata: false,
        }
    }
}

impl<Sink: DriverSink> ForwardingEmitter for DriverEmitter<'_, Sink> {
    type Token = Infallible;

    fn inner(&mut self) -> &mut impl Emitter<Token = Self::Token> {
        &mut self.inner
    }

    fn emit_eof(&mut self) {
        self.inner.emit_eof();
        let builder = self.inner.callback_mut().builder;
        let _ = builder.process_token(tokenizer::EOFToken, 1);
        builder.end();
    }

    fn emit_current_tag(&mut self) -> Option<State> {
        let _ = self.inner.emit_current_tag();
        let state = self.inner.callback_mut().next_state.take();
        if state.is_some() {
            self.inner.init_string();
        }
        state
    }

    fn adjusted_current_node_present_but_not_in_html_namespace(&mut self) -> bool {
        self.inner.emit_eof();
        self.inner.init_string();
        self.cdata = self
            .inner
            .callback_mut()
            .builder
            .adjusted_current_node_present_but_not_in_html_namespace();
        self.cdata
    }

    fn init_string(&mut self) {
        if self.cdata {
            self.cdata = false;
            self.inner.emit_eof();
        }
        self.inner.init_string();
    }
}

fn requested_state<Handle>(result: TokenSinkResult<Handle>) -> Option<State> {
    match result {
        TokenSinkResult::Continue | TokenSinkResult::EncodingIndicator(_) => None,
        TokenSinkResult::Script(_) => Some(State::Data),
        TokenSinkResult::Plaintext => Some(State::PlainText),
        TokenSinkResult::RawData(RawKind::Rcdata) => Some(State::RcData),
        TokenSinkResult::RawData(RawKind::Rawtext) => Some(State::RawText),
        TokenSinkResult::RawData(RawKind::ScriptData)
        | TokenSinkResult::RawData(RawKind::ScriptDataEscaped(_)) => Some(State::ScriptData),
    }
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}
