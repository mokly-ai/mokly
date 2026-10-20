//! Rename-only output retains an offset map for authored syntax diagnostics.

use std::collections::BTreeMap;

use crate::source_position::{line_column, line_start};

pub(crate) struct Scoped<'a> {
    pub(crate) source: &'a str,
    pub(crate) css: String,
    pub(crate) exports: BTreeMap<String, String>,
    pub(crate) edits: Vec<(usize, usize, String)>,
}

impl Scoped<'_> {
    /// The authored line and column of a zero-based line and one-based column
    /// in the scoped output, as `lightningcss` reports them.
    pub(crate) fn original_location(&self, line: u32, column: u32) -> (usize, usize) {
        let line_start = line_start(&self.css, line as usize);
        let offset = (line_start + column.saturating_sub(1) as usize).min(self.css.len());
        let mut delta: i128 = 0;
        let mut original = offset;
        for (start, end, replacement) in &self.edits {
            let output_start = (*start as i128 + delta) as usize;
            let output_end = output_start + replacement.len();
            if offset < output_start {
                original = (offset as i128 - delta) as usize;
                break;
            }
            if offset <= output_end {
                original = *start;
                break;
            }
            delta += replacement.len() as i128 - (end - start) as i128;
            original = (offset as i128 - delta) as usize;
        }
        line_column(self.source, original)
    }
}
