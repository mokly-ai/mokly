//! Map byte offsets in authored HTML to source lines and columns.

use std::iter;

use mokly_model::catalogue::SourceLocation;

/// The line starts of one authored text and the source position of its first character.
pub(crate) struct Locator {
    path: String,
    text: String,
    line_starts: Vec<usize>,
    line: usize,
    column: usize,
    shift: usize,
}

impl Locator {
    /// Index `text`, which starts at `line` and `column` of `path`.
    ///
    /// A leading byte order mark is not a column, as the parser drops it.
    pub(crate) fn new(text: &str, path: &str, line: usize, column: usize) -> Self {
        let shift = if text.starts_with('\u{feff}') {
            '\u{feff}'.len_utf8()
        } else {
            0
        };
        let text = text.get(shift..).unwrap_or_default().to_owned();
        let line_starts = iter::once(0)
            .chain(text.match_indices('\n').map(|(index, _)| index + 1))
            .collect();
        Self {
            path: path.into(),
            text,
            line_starts,
            line,
            column,
            shift,
        }
    }

    /// The source position of a byte offset in the original text, with columns in characters.
    pub(crate) fn locate(&self, offset: usize) -> SourceLocation {
        let offset = offset.saturating_sub(self.shift).min(self.text.len());
        let index = self
            .line_starts
            .partition_point(|start| *start <= offset)
            .saturating_sub(1);
        let start = self.line_starts.get(index).copied().unwrap_or_default();
        let first = if index == 0 { self.column } else { 1 };
        let characters = self
            .text
            .get(start..offset)
            .map_or(0, |text| text.chars().count());
        SourceLocation {
            path: self.path.clone(),
            line: self.line + index,
            column: first + characters,
            export: None,
        }
    }
}
