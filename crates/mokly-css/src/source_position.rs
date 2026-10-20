//! Line and column numbers of authored CSS, with the line breaks of CSS.
//!
//! CSS breaks lines at a line feed, a carriage return, a CRLF pair, and a form
//! feed, as cssparser counts them. Mokly's own diagnostics and the syntax
//! failures that `lightningcss` reports therefore agree on every line.

/// The byte offsets where the lines of `text` start.
fn line_starts(text: &str) -> impl Iterator<Item = usize> + '_ {
    let bytes = text.as_bytes();
    let breaks = bytes.iter().enumerate().filter_map(move |(index, byte)| {
        let ends_line = match byte {
            b'\n' | b'\x0C' => true,
            b'\r' => bytes.get(index + 1) != Some(&b'\n'),
            _ => false,
        };
        ends_line.then_some(index + 1)
    });
    std::iter::once(0).chain(breaks)
}

/// The one-based line and column of a byte offset. The column counts the
/// characters before the offset on its line.
pub(crate) fn line_column(text: &str, offset: usize) -> (usize, usize) {
    let mut offset = offset.min(text.len());
    while !text.is_char_boundary(offset) {
        offset -= 1;
    }
    let (line, start) = line_starts(text)
        .take_while(|start| *start <= offset)
        .enumerate()
        .last()
        .unwrap_or_default();
    (line + 1, text[start..offset].chars().count() + 1)
}

/// The byte offset where the zero-based `line` starts, or the end of `text`.
pub(crate) fn line_start(text: &str, line: usize) -> usize {
    line_starts(text).nth(line).unwrap_or(text.len())
}
