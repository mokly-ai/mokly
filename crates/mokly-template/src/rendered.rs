//! Authored source positions of the rendered body text.

use std::ops::Range;

use minijinja::OutputSpanKind;

use crate::source_map::SourceMap;

/// What contributed the rendered bytes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SpanKind {
    /// Literal bytes copied from the source.
    Raw,
    /// Text written by template evaluation.
    Expression,
}

/// One run of rendered bytes and the authored bytes that produced it.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OutputSpan {
    /// Byte range in the rendered text.
    pub output: Range<usize>,
    /// Byte range in the authored body.
    pub source: Range<usize>,
    /// How the output maps to the authored body.
    pub kind: SpanKind,
}

impl OutputSpan {
    pub(crate) fn from_minijinja(span: &minijinja::OutputSpan, map: &SourceMap) -> Self {
        let (kind, source) = match span.kind() {
            OutputSpanKind::Raw => (SpanKind::Raw, map.range(span.source_range())),
            _ => (
                SpanKind::Expression,
                map.expression_range(span.source_range()),
            ),
        };
        Self {
            output: span.output_range(),
            source,
            kind,
        }
    }
}

/// The text and locations to pass to the HTML parser.
#[derive(Debug, Default)]
pub struct RenderedBody {
    /// Rendered HTML text.
    pub text: String,
    /// Non-overlapping spans in output order.
    pub spans: Vec<OutputSpan>,
}

impl RenderedBody {
    /// Map a rendered byte to the corresponding authored byte or expression start.
    pub fn source_offset(&self, output_offset: usize) -> Option<usize> {
        let index = self
            .spans
            .partition_point(|span| span.output.end <= output_offset);
        let span = self
            .spans
            .get(index)
            .filter(|span| span.output.contains(&output_offset))?;
        let offset = match span.kind {
            SpanKind::Raw => output_offset - span.output.start,
            SpanKind::Expression => 0,
        };
        Some(span.source.start + offset)
    }
}
