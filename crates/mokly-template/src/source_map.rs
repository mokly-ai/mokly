//! Map byte ranges in lowered template source back to the authored body.

use std::ops::Range;

use minijinja::Error;

struct Piece {
    lowered: Range<usize>,
    authored: Range<usize>,
    copied: bool,
}

struct TagSite {
    source: Range<usize>,
    opener: usize,
    output_start: usize,
}

/// A sparse table of copied and generated pieces of a lowered template.
#[derive(Default)]
pub(crate) struct SourceMap {
    pieces: Vec<Piece>,
    tags: Vec<TagSite>,
}

impl SourceMap {
    pub(crate) fn range(&self, range: Range<usize>) -> Range<usize> {
        let start = self.start(range.start);
        if range.is_empty() {
            return start..start;
        }
        let end = self.piece_at(range.end - 1).map_or_else(
            || self.authored_end(),
            |piece| {
                if piece.copied {
                    piece.authored.start + range.end - piece.lowered.start
                } else {
                    piece.authored.end
                }
            },
        );
        start..end.max(start)
    }

    pub(crate) fn error_offset(&self, error: &Error) -> Option<usize> {
        let offset = self.start(error.range()?.start);
        Some(self.tag_at(offset).map_or(offset, |tag| tag.opener))
    }

    pub(crate) fn expression_range(&self, range: Range<usize>) -> Range<usize> {
        let mut source = self.range(range);
        if let Some(tag) = self.tag_at(source.start)
            && source == tag.source
        {
            source.start = tag.output_start;
        }
        source
    }

    fn tag_at(&self, offset: usize) -> Option<&TagSite> {
        let index = self.tags.partition_point(|tag| tag.source.start <= offset);
        self.tags
            .get(index.checked_sub(1)?)
            .filter(|tag| tag.source.contains(&offset))
    }

    fn start(&self, offset: usize) -> usize {
        self.piece_at(offset).map_or_else(
            || self.authored_end(),
            |piece| {
                if piece.copied {
                    piece.authored.start + offset - piece.lowered.start
                } else {
                    piece.authored.start
                }
            },
        )
    }

    fn piece_at(&self, offset: usize) -> Option<&Piece> {
        let index = self
            .pieces
            .partition_point(|piece| piece.lowered.end <= offset);
        self.pieces.get(index)
    }

    fn authored_end(&self) -> usize {
        self.pieces.last().map_or(0, |piece| piece.authored.end)
    }
}

pub(crate) struct SourceWriter<'a> {
    authored: &'a str,
    lowered: String,
    map: SourceMap,
}

impl<'a> SourceWriter<'a> {
    pub(crate) fn new(authored: &'a str) -> Self {
        Self {
            authored,
            lowered: String::with_capacity(authored.len()),
            map: SourceMap::default(),
        }
    }

    pub(crate) fn copy(&mut self, range: Range<usize>) {
        self.push(&self.authored[range.clone()], range, true);
    }

    pub(crate) fn replace(&mut self, generated: &str, range: Range<usize>) {
        self.push(generated, range, false);
    }

    pub(crate) fn tag(&mut self, source: Range<usize>, opener: usize, output_start: usize) {
        self.map.tags.push(TagSite {
            source,
            opener,
            output_start,
        });
    }

    pub(crate) fn finish(self) -> (String, SourceMap) {
        (self.lowered, self.map)
    }

    fn push(&mut self, text: &str, authored: Range<usize>, copied: bool) {
        if text.is_empty() {
            return;
        }
        let start = self.lowered.len();
        self.lowered.push_str(text);
        self.map.pieces.push(Piece {
            lowered: start..self.lowered.len(),
            authored,
            copied,
        });
    }
}
