//! YAML 1.2 core data parsing with key positions, aliases, and duplicate rejection.
//!
//! The builder keeps one heap frame per open sequence or mapping, so authored
//! nesting does not consume native stack. Each node's JSON pointer is built once
//! from its parent's pointer. A value deeper than [`MAX_DEPTH`] fails where it
//! starts, so later recursive traversal of the decoded value stays bounded.
//! Before the build, the alias scan bounds the nodes that aliases expand to,
//! and the builder keeps copies of only the anchors that an alias refers to.

use std::collections::{BTreeMap, BTreeSet};
use std::str::Chars;

use mokly_model::catalogue::SourceLocation;
use serde_json::{Number, Value};
use yaml_rust2::Yaml;
use yaml_rust2::parser::{Event, Parser, Tag};
use yaml_rust2::scanner::{Marker, TScalarStyle};

use crate::diagnostic::{Code, Issue};
use crate::yaml_aliases;
use crate::yaml_frame::{Frame, Rejected};
use crate::yaml_limits::{MAX_ALIAS_NODES, MAX_DEPTH};
use crate::yaml_positions::{Positions, ROOT};
use crate::yaml_value::{copy, discard, height};

/// A decoded authoring value and its JSON-pointer source locations.
#[derive(Debug)]
pub(crate) struct Document {
    pub(crate) value: Value,
    pub(crate) positions: Positions,
}

/// Parse exactly one YAML document without evaluating custom tags.
pub(crate) fn parse(text: &str, path: &str, first_line: usize) -> Result<Document, Issue> {
    let mut reader = Reader {
        parser: Parser::new_from_str(text),
        path,
        first_line,
        aliased: BTreeSet::new(),
        anchors: BTreeMap::new(),
    };
    reader.aliased = match yaml_aliases::scan(text, MAX_ALIAS_NODES) {
        Ok(aliased) => aliased,
        Err(marker) => {
            let message =
                format!("YAML aliases exceed {MAX_ALIAS_NODES} expanded nodes; use fewer aliases");
            return Err(reader.error(marker, message));
        }
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
    /// The anchors that an alias refers to.
    aliased: BTreeSet<usize>,
    /// Anchored nodes with locations relative to the node.
    anchors: BTreeMap<usize, Anchor>,
}

/// An anchored node and the number of levels below it.
struct Anchor {
    document: Document,
    height: usize,
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
    /// Fail when a value would sit more than [`MAX_DEPTH`] levels below the root.
    fn within(&self, depth: usize, marker: Marker) -> Result<(), Issue> {
        if depth > MAX_DEPTH {
            let message =
                format!("YAML value exceeds {MAX_DEPTH} nesting levels; reduce its nesting");
            return Err(self.error(marker, message));
        }
        Ok(())
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

    /// Build the node that starts with `event`. Open containers stay on the heap.
    fn node(&mut self, mut event: Event, mut marker: Marker) -> Result<Document, Issue> {
        let mut frames: Vec<Frame> = Vec::new();
        let mut positions = Positions::default();
        loop {
            let sequence = matches!(event, Event::SequenceStart(..));
            let (value, start) = match event {
                Event::Scalar(text, style, anchor, tag) => {
                    self.within(frames.len(), marker)?;
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
                    let start = self.location(marker);
                    if let Some(slot) = target(&frames, &mut positions) {
                        positions.set(slot, start.clone());
                    }
                    if anchor != 0 {
                        self.anchor(anchor, &value, Positions::at(start.clone()));
                    }
                    (value, start)
                }
                Event::Alias(anchor) => {
                    let Some(node) = self.anchors.get(&anchor) else {
                        return Err(self.error(marker, "unknown or recursive YAML alias"));
                    };
                    self.within(frames.len() + node.height, marker)?;
                    let node = &node.document;
                    let start = self.location(marker);
                    if let Some(slot) = target(&frames, &mut positions) {
                        positions.graft(slot, &node.positions, ROOT);
                        positions.set(slot, start.clone());
                    }
                    (copy(&node.value), start)
                }
                Event::SequenceStart(anchor, tag) | Event::MappingStart(anchor, tag) => {
                    self.within(frames.len(), marker)?;
                    self.tag(&tag, marker)?;
                    let start = self.location(marker);
                    let slot = target(&frames, &mut positions);
                    if let Some(slot) = slot {
                        positions.set(slot, start.clone());
                    }
                    frames.push(Frame::new(sequence, slot, anchor, start));
                    (event, marker) = self.next()?;
                    continue;
                }
                Event::SequenceEnd | Event::MappingEnd
                    if frames.last().is_some_and(|frame| frame.closes(&event)) =>
                {
                    let Some(mut frame) = frames.pop() else {
                        return Err(self.error(marker, "expected a YAML value"));
                    };
                    let value = frame.take();
                    if frame.anchor != 0 {
                        let local = match frame.slot {
                            Some(slot) => positions.subtree(slot),
                            None => Positions::at(frame.start.clone()),
                        };
                        self.anchor(frame.anchor, &value, local);
                    }
                    (value, frame.start.clone())
                }
                _ => return Err(self.error(marker, "expected a YAML value")),
            };
            let Some(frame) = frames.last_mut() else {
                return Ok(Document { value, positions });
            };
            if let Err(rejected) = frame.attach(value, start, &mut positions) {
                return Err(match *rejected {
                    Rejected::NotString(value, start) => {
                        discard(value);
                        let message = "YAML object keys must be strings";
                        Issue::new(Code::HtmlFrontMatter, message).at(start)
                    }
                    Rejected::Duplicate(key, start) => {
                        let message = format!("duplicate key {key}");
                        Issue::new(Code::HtmlFrontMatter, message).at(start)
                    }
                });
            }
            (event, marker) = self.next()?;
        }
    }

    /// Register an anchored node that an alias refers to, with its locations
    /// relative to the node.
    fn anchor(&mut self, anchor: usize, value: &Value, positions: Positions) {
        if !self.aliased.contains(&anchor) {
            return;
        }
        let height = height(value);
        let document = Document {
            value: copy(value),
            positions,
        };
        self.anchors.insert(anchor, Anchor { document, height });
    }
}

/// The position slot of the node that starts next; `None` inside a mapping key.
fn target(frames: &[Frame], positions: &mut Positions) -> Option<usize> {
    frames
        .last()
        .map_or(Some(ROOT), |frame| frame.child(positions))
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

#[cfg(test)]
#[path = "_tests_/yaml_depth_tests.rs"]
mod yaml_depth_tests;
