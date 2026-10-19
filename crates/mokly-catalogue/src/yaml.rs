//! YAML 1.2 core data parsing with key positions, aliases, and duplicate rejection.

use std::collections::BTreeMap;
use std::str::Chars;

use mokly_model::catalogue::SourceLocation;
use serde_json::{Map, Number, Value};
use yaml_rust2::Yaml;
use yaml_rust2::parser::{Event, Parser, Tag};
use yaml_rust2::scanner::{Marker, TScalarStyle};

use crate::diagnostic::{Code, Issue};

/// A decoded authoring value and its JSON-pointer source locations.
#[derive(Debug)]
pub(crate) struct Document {
    pub(crate) value: Value,
    pub(crate) positions: BTreeMap<String, SourceLocation>,
}

/// Parse exactly one YAML document without evaluating custom tags.
pub(crate) fn parse(text: &str, path: &str, first_line: usize) -> Result<Document, Issue> {
    let mut reader = Reader {
        parser: Parser::new_from_str(text),
        path,
        first_line,
        anchors: BTreeMap::new(),
    };
    loop {
        let (event, marker) = reader.next()?;
        if !matches!(event, Event::StreamStart | Event::DocumentStart) {
            let document = reader.node(event, marker)?;
            loop {
                let (event, marker) = reader.next()?;
                match event {
                    Event::StreamEnd => return Ok(document),
                    Event::DocumentEnd => {}
                    _ => return Err(reader.error(marker, "expected one YAML document")),
                }
            }
        }
    }
}

struct Reader<'a> {
    parser: Parser<Chars<'a>>,
    path: &'a str,
    first_line: usize,
    anchors: BTreeMap<usize, Document>,
}

impl Reader<'_> {
    fn next(&mut self) -> Result<(Event, Marker), Issue> {
        match self.parser.next_token() {
            Ok(event) => Ok(event),
            Err(error) => Err(self.error(*error.marker(), error.info())),
        }
    }
    fn location(&self, marker: Marker) -> SourceLocation {
        SourceLocation {
            path: self.path.into(),
            line: marker.line() + self.first_line - 1,
            column: marker.col() + 1,
            export: None,
        }
    }
    fn error(&self, marker: Marker, message: impl Into<String>) -> Issue {
        Issue::new(Code::HtmlFrontMatter, message).at(self.location(marker))
    }
    fn tag(&self, tag: &Option<Tag>, marker: Marker) -> Result<(), Issue> {
        if tag
            .as_ref()
            .is_some_and(|tag| tag.handle != "tag:yaml.org,2002:" && tag.handle != "!!")
        {
            return Err(self.error(marker, "custom YAML tags are not allowed"));
        }
        Ok(())
    }
    fn node(&mut self, mut event: Event, mut marker: Marker) -> Result<Document, Issue> {
        let mut frames: Vec<Frame> = Vec::new();
        loop {
            let positions = BTreeMap::from([(String::new(), self.location(marker))]);
            let sequence = matches!(&event, Event::SequenceStart(..));
            let (mut node, anchor) = match event {
                Event::Scalar(text, style, anchor, tag) => {
                    self.tag(&tag, marker)?;
                    let quoted = style != TScalarStyle::Plain
                        || tag.as_ref().is_some_and(|tag| tag.suffix == "str");
                    let value = if quoted {
                        Value::String(text)
                    } else {
                        scalar(&text).ok_or_else(|| {
                            self.error(marker, "YAML value is not finite JSON data")
                        })?
                    };
                    (Document { value, positions }, anchor)
                }
                Event::Alias(anchor) => {
                    let Some(mut node) = self.anchors.get(&anchor).cloned() else {
                        return Err(self.error(marker, "unknown or recursive YAML alias"));
                    };
                    node.positions.insert(String::new(), self.location(marker));
                    (node, 0)
                }
                Event::SequenceStart(anchor, tag) | Event::MappingStart(anchor, tag) => {
                    self.tag(&tag, marker)?;
                    let value = if sequence {
                        Value::Array(Vec::new())
                    } else {
                        Value::Object(Map::new())
                    };
                    frames.push(Frame {
                        document: Document { value, positions },
                        anchor,
                        key: None,
                    });
                    (event, marker) = self.next()?;
                    continue;
                }
                Event::SequenceEnd | Event::MappingEnd => {
                    let Some(frame) = frames.pop() else {
                        return Err(self.error(marker, "expected a YAML value"));
                    };
                    (frame.document, frame.anchor)
                }
                _ => return Err(self.error(marker, "expected a YAML value")),
            };
            if anchor != 0 {
                self.anchors.insert(anchor, node.clone());
            }
            let Some(frame) = frames.last_mut() else {
                return Ok(node);
            };
            match &mut frame.document.value {
                Value::Array(values) => {
                    append(
                        &mut frame.document.positions,
                        &format!("/{}", values.len()),
                        std::mem::take(&mut node.positions),
                    );
                    values.push(std::mem::take(&mut node.value));
                }
                Value::Object(values) => {
                    if let Some((key, location)) = frame.key.take() {
                        let pointer = format!("/{}", key.replace('~', "~0").replace('/', "~1"));
                        append(
                            &mut frame.document.positions,
                            &pointer,
                            std::mem::take(&mut node.positions),
                        );
                        frame.document.positions.insert(pointer, location);
                        values.insert(key, std::mem::take(&mut node.value));
                    } else {
                        let location = node
                            .positions
                            .get("")
                            .cloned()
                            .unwrap_or_else(|| self.location(marker));
                        let Some(key) = node.value.as_str() else {
                            return Err(Issue::new(
                                Code::HtmlFrontMatter,
                                "YAML object keys must be strings",
                            )
                            .at(location));
                        };
                        if values.contains_key(key) {
                            return Err(Issue::new(
                                Code::HtmlFrontMatter,
                                format!("duplicate key {key}"),
                            )
                            .at(location));
                        }
                        frame.key = Some((key.into(), location));
                    }
                }
                _ => return Err(self.error(marker, "expected a YAML container")),
            }
            (event, marker) = self.next()?;
        }
    }
}

struct Frame {
    document: Document,
    anchor: usize,
    key: Option<(String, SourceLocation)>,
}

fn append(
    target: &mut BTreeMap<String, SourceLocation>,
    prefix: &str,
    child: BTreeMap<String, SourceLocation>,
) {
    for (pointer, location) in child {
        target.insert(format!("{prefix}{pointer}"), location);
    }
}

fn scalar(text: &str) -> Option<Value> {
    if matches!(text, "null" | "Null" | "NULL" | "~" | "") {
        return Some(Value::Null);
    }
    if text == "-0" {
        return Number::from_f64(-0.0).map(Value::Number);
    }
    match Yaml::from_str(text) {
        Yaml::Null => Some(Value::Null),
        Yaml::Boolean(value) => Some(Value::Bool(value)),
        Yaml::Integer(value) => Some(Value::Number(value.into())),
        Yaml::Real(value) => value
            .parse::<f64>()
            .ok()
            .and_then(Number::from_f64)
            .map(Value::Number),
        Yaml::String(value) => Some(Value::String(value)),
        _ => None,
    }
}
