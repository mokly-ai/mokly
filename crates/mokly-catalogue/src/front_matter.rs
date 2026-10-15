//! Exact front matter delimiters, shared by HTML and Markdown readers.

use crate::diagnostic::{Code, Issue};
use crate::locations::at;

/// Byte slices and offsets retain exact original source coordinates.
pub(crate) struct Block<'a> {
    pub(crate) header: Option<&'a str>,
    pub(crate) body: &'a str,
    pub(crate) body_offset: usize,
}

pub(crate) fn split<'a>(text: &'a str, path: &str, required: bool) -> Result<Block<'a>, Issue> {
    let bom = if text.starts_with('\u{feff}') {
        '\u{feff}'.len_utf8()
    } else {
        0
    };
    let source = &text[bom..];
    let mut offset = 0;
    let mut lines = source.split_inclusive('\n');
    let first = lines.next().unwrap_or("");
    if line(first) != "---" {
        if required {
            return Err(
                Issue::new(Code::HtmlFrontMatter, "missing front matter block")
                    .at(at(path, text, bom)),
            );
        }
        return Ok(Block {
            header: None,
            body: source,
            body_offset: bom,
        });
    }
    offset += first.len();
    let header_start = offset;
    for item in lines {
        if line(item) == "---" {
            return Ok(Block {
                header: Some(&source[header_start..offset]),
                body: &source[offset + item.len()..],
                body_offset: bom + offset + item.len(),
            });
        }
        offset += item.len();
    }
    Err(Issue::new(
        if required {
            Code::HtmlFrontMatter
        } else {
            Code::DocumentFrontMatter
        },
        format!("{path}: front matter block is not closed"),
    )
    .at(at(path, text, bom)))
}

fn line(text: &str) -> &str {
    text.strip_suffix('\n')
        .unwrap_or(text)
        .strip_suffix('\r')
        .unwrap_or(text.strip_suffix('\n').unwrap_or(text))
}
