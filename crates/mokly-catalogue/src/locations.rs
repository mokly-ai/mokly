//! Source offsets and JSON-pointer positions, without filesystem access.

use std::collections::BTreeMap;

use mokly_model::catalogue::SourceLocation;

/// One-based source coordinate from a UTF-8 byte offset.
pub(crate) fn at(path: &str, text: &str, offset: usize) -> SourceLocation {
    let mut end = offset.min(text.len());
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    let prefix = &text[..end];
    SourceLocation {
        path: path.into(),
        line: prefix.bytes().filter(|c| *c == b'\n').count() + 1,
        column: prefix
            .rsplit('\n')
            .next()
            .map_or(1, |line| line.chars().count() + 1),
        export: None,
    }
}

/// Locate a decoded HTML substitution with LF, CRLF, and CR line endings.
pub(crate) fn html_at(path: &str, text: &str, offset: usize) -> SourceLocation {
    let mut location = at(path, text, offset);
    let mut characters = text
        .get(..offset.min(text.len()))
        .unwrap_or_default()
        .chars()
        .peekable();
    location.line = 1;
    location.column = 1;
    while let Some(character) = characters.next() {
        if matches!(character, '\r' | '\n') {
            if character == '\r' && characters.peek() == Some(&'\n') {
                characters.next();
            }
            location.line += 1;
            location.column = 1;
        } else {
            location.column += 1;
        }
    }
    location
}

/// Locate JSON object fields and values by JSON Pointer. JSON is validated separately.
pub(crate) fn json_positions(text: &str) -> BTreeMap<String, usize> {
    let mut scanner = JsonPositions {
        text,
        offset: 0,
        positions: BTreeMap::new(),
    };
    scanner.value("");
    scanner.positions
}

struct JsonPositions<'a> {
    text: &'a str,
    offset: usize,
    positions: BTreeMap<String, usize>,
}

impl JsonPositions<'_> {
    fn space(&mut self) {
        while self
            .text
            .as_bytes()
            .get(self.offset)
            .is_some_and(u8::is_ascii_whitespace)
        {
            self.offset += 1;
        }
    }
    fn string(&mut self) -> String {
        let start = self.offset;
        self.offset += 1;
        while let Some(c) = self.text.as_bytes().get(self.offset) {
            self.offset += 1;
            if *c == b'\\' {
                self.offset += 1;
            } else if *c == b'"' {
                break;
            }
        }
        serde_json::from_str(self.text.get(start..self.offset).unwrap_or("\"\""))
            .unwrap_or_default()
    }
    fn value(&mut self, pointer: &str) {
        self.space();
        self.positions.entry(pointer.into()).or_insert(self.offset);
        match self.text.as_bytes().get(self.offset) {
            Some(b'{') => {
                self.offset += 1;
                self.space();
                while self.text.as_bytes().get(self.offset) == Some(&b'"') {
                    let start = self.offset;
                    let key = self.string().replace('~', "~0").replace('/', "~1");
                    let path = format!("{pointer}/{key}");
                    self.positions.insert(path.clone(), start);
                    self.space();
                    self.offset += 1;
                    self.value(&path);
                    self.space();
                    if self.text.as_bytes().get(self.offset) != Some(&b',') {
                        break;
                    }
                    self.offset += 1;
                    self.space();
                }
                self.offset += 1;
            }
            Some(b'[') => {
                self.offset += 1;
                self.space();
                let mut index = 0;
                while self.offset < self.text.len()
                    && self.text.as_bytes().get(self.offset) != Some(&b']')
                {
                    self.value(&format!("{pointer}/{index}"));
                    index += 1;
                    self.space();
                    if self.text.as_bytes().get(self.offset) != Some(&b',') {
                        break;
                    }
                    self.offset += 1;
                }
                self.offset += 1;
            }
            Some(b'"') => {
                self.string();
            }
            _ => {
                while self
                    .text
                    .as_bytes()
                    .get(self.offset)
                    .is_some_and(|c| !c.is_ascii_whitespace() && !b",]}".contains(c))
                {
                    self.offset += 1;
                }
            }
        }
    }
}
