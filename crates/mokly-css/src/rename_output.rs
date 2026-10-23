//! Rename-only output retains an offset map for authored syntax diagnostics.

use std::collections::BTreeMap;

use crate::source_position::{line_column, utf16_offset};

pub(crate) struct Scoped<'a> {
    pub(crate) source: &'a str,
    pub(crate) css: String,
    pub(crate) exports: BTreeMap<String, String>,
    pub(crate) edits: Vec<(usize, usize, String)>,
}

impl Scoped<'_> {
    /// The authored line and column of a location in the scoped output, as
    /// `lightningcss` reports it: a zero-based line and a one-based column in
    /// UTF-16 code units. A position inside a replacement maps to the start of
    /// the authored text that it replaced, and a position right after an edit
    /// maps to the authored text right after it.
    pub(crate) fn original_location(&self, line: u32, column: u32) -> (usize, usize) {
        let offset = utf16_offset(&self.css, line as usize, column as usize);
        let mut delta: i128 = 0;
        let mut original = offset;
        for (start, end, replacement) in &self.edits {
            let output_start = (*start as i128 + delta) as usize;
            let output_end = output_start + replacement.len();
            if offset < output_start {
                original = (offset as i128 - delta) as usize;
                break;
            }
            if offset < output_end {
                original = *start;
                break;
            }
            delta += replacement.len() as i128 - (end - start) as i128;
            original = (offset as i128 - delta) as usize;
        }
        line_column(self.source, original)
    }
}
