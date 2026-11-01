//! Sparse decoded-byte origins anchored at html5gum emission chunk ends.

use std::mem;

use crate::html_token_types::Span;

#[derive(Clone, Debug, Eq, PartialEq)]
struct Breakpoint {
    decoded: usize,
    source: usize,
    aligned: bool,
}

/// Source coordinates for decoded text or one attribute value.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceMap {
    /// Actual consumed source interval, independent of tokenizer compatibility spans.
    pub span: Span,
    breaks: Vec<Breakpoint>,
}

impl Default for SourceMap {
    fn default() -> Self {
        Self::plain(Span { start: 0, end: 0 })
    }
}

impl SourceMap {
    /// Represent a value whose bytes retain their source offsets.
    pub(crate) fn plain(span: Span) -> Self {
        Self {
            span,
            breaks: Vec::new(),
        }
    }

    /// Map a decoded byte offset to its source byte, bounded by the value's range.
    pub fn source_offset(&self, decoded: usize) -> usize {
        let index = self
            .breaks
            .partition_point(|point| point.decoded <= decoded);
        let offset = match index
            .checked_sub(1)
            .and_then(|index| self.breaks.get(index))
        {
            Some(point) if point.aligned => point.source + decoded - point.decoded,
            Some(point) => point.source,
            None => self.span.start + decoded,
        };
        offset.clamp(
            self.span.start,
            self.span.end.saturating_sub(1).max(self.span.start),
        )
    }

    /// Whether a decoded byte belongs to a chunk aligned with its source bytes.
    pub fn is_aligned(&self, decoded: usize) -> bool {
        let index = self
            .breaks
            .partition_point(|point| point.decoded <= decoded);
        index
            .checked_sub(1)
            .and_then(|index| self.breaks.get(index))
            .is_none_or(|point| point.aligned)
    }
}

#[derive(Default)]
struct Buffer {
    start: usize,
    /// The next byte to align, which can precede a buffered emission's parser position.
    end: usize,
    /// Furthest source position consumed for this value's emitted chunks.
    consumed_end: usize,
    decoded: usize,
    breaks: Vec<Breakpoint>,
}

impl Buffer {
    fn begin(&mut self, position: usize) {
        if self.decoded == 0 {
            self.start = position;
            self.end = position;
            self.consumed_end = position;
        }
    }

    fn point(&mut self, decoded: usize, source: usize, aligned: bool) {
        let offset = self.breaks.last().map_or(self.start + decoded, |point| {
            if point.aligned {
                point.source + decoded - point.decoded
            } else {
                point.source
            }
        });
        if offset != source
            || self
                .breaks
                .last()
                .is_some_and(|point| point.aligned != aligned)
            || !aligned
        {
            self.breaks.push(Breakpoint {
                decoded,
                source,
                aligned,
            });
        }
    }

    fn record(&mut self, source: &[u8], value: &[u8], position: usize, consumed: usize) {
        if value.is_empty() {
            return;
        }
        let mut start = self.end;
        if source.get(start) == Some(&b'\n') && start > 0 && source.get(start - 1) == Some(&b'\r') {
            start += 1;
        }
        let mut end = position.max(start).min(source.len());
        let raw = source.get(start..end).unwrap_or_default();
        if raw == value {
            self.point(self.decoded, start, true);
        } else if let Some((length, points)) = align(
            source.get(start..consumed).unwrap_or_default(),
            value,
            start,
            self.decoded,
        )
        .filter(|(length, _)| source.get(start) != Some(&b'&') || *length >= end - start)
        {
            end = start + length;
            self.point(self.decoded, start, true);
            self.breaks.extend(points);
        } else {
            self.point(self.decoded, start.min(end), false);
        }
        self.decoded += value.len();
        self.end = end;
        self.consumed_end = self.consumed_end.max(position).max(end).min(source.len());
        self.point(self.decoded, end, true);
    }

    fn finish(&mut self, source: &[u8], value: &[u8]) -> SourceMap {
        let buffer = mem::take(self);
        let span = Span {
            start: buffer.start,
            end: buffer.consumed_end,
        };
        let breaks = if source.get(span.start..span.end) == Some(value) {
            Vec::new()
        } else {
            buffer.breaks
        };
        SourceMap { span, breaks }
    }
}

/// Align literal chunks without decoding character references a second time.
fn align(
    raw: &[u8],
    value: &[u8],
    start: usize,
    decoded: usize,
) -> Option<(usize, Vec<Breakpoint>)> {
    let mut cursor = 0;
    let mut points = Vec::new();
    for (index, byte) in value.iter().enumerate() {
        if raw.get(cursor) == Some(byte) {
            cursor += 1;
        } else if raw.get(cursor) == Some(&b'\r') && *byte == b'\n' {
            cursor += 1;
            if raw.get(cursor) == Some(&b'\n') {
                cursor += 1;
                points.push(Breakpoint {
                    decoded: decoded + index + 1,
                    source: start + cursor,
                    aligned: true,
                });
            }
        } else {
            return None;
        }
    }
    Some((cursor, points))
}

/// Emission buffers share the tokenizer's current source position.
pub(crate) struct Recorder<'a> {
    source: &'a [u8],
    position: usize,
    consumed: usize,
    text: Buffer,
    attribute: Buffer,
}

impl<'a> Recorder<'a> {
    /// Track byte positions in the original source, including a leading byte order mark.
    pub(crate) fn new(source: &'a str, offset: usize) -> Self {
        Self {
            source: source.as_bytes(),
            position: offset,
            consumed: offset,
            text: Buffer::default(),
            attribute: Buffer::default(),
        }
    }

    /// Retain the furthest consumed position across temporary tokenizer rewinds.
    pub(crate) fn move_position(&mut self, offset: isize) {
        self.position = self.position.saturating_add_signed(offset);
        self.consumed = self.consumed.max(self.position).min(self.source.len());
    }

    /// Start a text value only when no prior emission is still buffered.
    pub(crate) fn init_string(&mut self) {
        self.text.begin(self.position);
    }

    /// Start after a quote or at the unquoted byte that the tokenizer reconsumes.
    pub(crate) fn init_attribute_value(&mut self) {
        let quoted = self
            .position
            .checked_sub(1)
            .and_then(|index| self.source.get(index))
            .is_some_and(|byte| matches!(byte, b'\'' | b'"'));
        self.attribute.begin(if quoted {
            self.position
        } else {
            self.position.saturating_sub(1)
        });
    }

    /// Record one emitted text chunk before the callback combines it with earlier chunks.
    pub(crate) fn emit_string(&mut self, value: &[u8]) {
        self.text
            .record(self.source, value, self.position, self.consumed);
    }

    /// Record one decoded attribute chunk at its tokenizer source position.
    pub(crate) fn push_attribute_value(&mut self, value: &[u8]) {
        self.attribute
            .record(self.source, value, self.position, self.consumed);
    }

    /// Finish the text map from consumed source bytes, independently of compatibility spans.
    pub(crate) fn text(&mut self, value: &[u8]) -> SourceMap {
        self.text.finish(self.source, value)
    }

    /// Finish the current attribute value's source map.
    pub(crate) fn attribute(&mut self, value: &[u8]) -> SourceMap {
        self.attribute.finish(self.source, value)
    }
}
