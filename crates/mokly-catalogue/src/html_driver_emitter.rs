//! Forward html5gum calls while recording decoded-byte source origins.

use std::convert::Infallible;

use html5ever::tokenizer::{self, TokenSink};
use html5ever::tree_builder::TreeBuilder;
use html5gum::emitters::callback::CallbackEmitter;
use html5gum::{Emitter, ForwardingEmitter, State};

use crate::html_driver::DriverSink;
use crate::html_driver_events::EventSink;

/// The html5gum emitter that lets the tree builder choose each tokenizer state.
pub(crate) struct DriverEmitter<'a, Sink: DriverSink> {
    inner: CallbackEmitter<EventSink<'a, Sink>, Infallible, usize>,
    cdata: bool,
}

impl<'a, Sink: DriverSink> DriverEmitter<'a, Sink> {
    /// Forward tokens and source origins into the supplied tree builder.
    pub(crate) fn new(
        builder: &'a TreeBuilder<Sink::Handle, Sink>,
        source: &'a str,
        offset: usize,
    ) -> Self {
        Self {
            inner: CallbackEmitter::new(EventSink::new(builder, source, offset)),
            cdata: false,
        }
    }
}

impl<Sink: DriverSink> ForwardingEmitter for DriverEmitter<'_, Sink> {
    type Token = Infallible;

    fn inner(&mut self) -> &mut impl Emitter<Token = Self::Token> {
        &mut self.inner
    }

    fn move_position(&mut self, offset: isize) {
        self.inner.callback_mut().recorder.move_position(offset);
        self.inner.move_position(offset);
    }

    fn emit_string(&mut self, value: &[u8]) {
        self.inner.callback_mut().recorder.emit_string(value);
        self.inner.emit_string(value);
    }

    fn init_attribute_value(&mut self) {
        self.inner.callback_mut().recorder.init_attribute_value();
        self.inner.init_attribute_value();
    }

    fn push_attribute_value(&mut self, value: &[u8]) {
        self.inner
            .callback_mut()
            .recorder
            .push_attribute_value(value);
        self.inner.push_attribute_value(value);
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
            self.inner.callback_mut().recorder.init_string();
            self.inner.init_string();
        }
        state
    }

    fn adjusted_current_node_present_but_not_in_html_namespace(&mut self) -> bool {
        self.inner.emit_eof();
        self.inner.callback_mut().recorder.init_string();
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
        self.inner.callback_mut().recorder.init_string();
        self.inner.init_string();
    }
}
