//! pnpm lockfile scalars with the folders that pnpm resolves them from.
//!
//! Importer specifiers and `link:` versions resolve from their importer. Every
//! other value resolves from the lockfile folder. Merge keys are transparent.
//! A position that YAML can hide, such as an alias, a complex key, or an
//! importer without a plain name, uses the repository root, the strictest base.

use std::collections::{BTreeMap, BTreeSet};

use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::manifest;

/// Check one scalar from one base folder, with `true` when its field is a path.
pub(crate) type Check<'a> = dyn FnMut(&str, &str, bool) -> Result<()> + 'a;

const SECTIONS: [&str; 3] = ["dependencies", "devDependencies", "optionalDependencies"];
const PATHS: [&str; 3] = ["directory", "path", "publishDirectory"];

#[derive(Clone, PartialEq)]
enum Key {
    Name(String),
    Item,
    Unknown,
}

/// The effective key path of a node: its first five keys, depth, and last key.
#[derive(Clone, Default)]
struct Position {
    names: Vec<Key>,
    depth: usize,
    last: Option<Key>,
    unknown: bool,
    merged: bool,
}

impl Position {
    fn child(&self, key: &Key) -> Self {
        let mut child = Self {
            merged: false,
            ..self.clone()
        };
        if self.merged && *key == Key::Item {
            return child;
        }
        if matches!(key, Key::Name(name) if name == "<<") {
            child.merged = true;
            return child;
        }
        child.unknown |= *key == Key::Unknown;
        if child.names.len() < 5 {
            child.names.push(key.clone());
        }
        child.depth += 1;
        child.last = Some(key.clone());
        child
    }

    fn name(&self, index: usize) -> Option<&str> {
        match self.names.get(index) {
            Some(Key::Name(name)) => Some(name),
            _ => None,
        }
    }

    fn path(&self) -> bool {
        matches!(&self.last, Some(Key::Name(name)) if PATHS.contains(&name.as_str()))
    }

    fn bases(&self, value: bool, scalar: &str, folder: &str) -> Result<Vec<String>> {
        if self.unknown {
            return Ok(vec![String::new()]);
        }
        if self.name(0) != Some("importers") || self.depth < 2 {
            return Ok(vec![folder.to_owned()]);
        }
        let Some(importer) = self.name(1) else {
            return Ok(vec![String::new()]);
        };
        let importer = manifest::target(folder, importer)?;
        let section = self
            .name(2)
            .is_some_and(|section| SECTIONS.contains(&section));
        let specifier = value
            && ((self.depth == 4 && self.name(2) == Some("specifiers"))
                || (self.depth == 5 && section && self.name(4) == Some("specifier")));
        let version = value
            && section
            && (self.depth == 4 || (self.depth == 5 && self.name(4) == Some("version")));
        if specifier || (version && scalar.starts_with("link:")) {
            Ok(vec![importer])
        } else {
            Ok(vec![folder.to_owned(), importer])
        }
    }
}

struct Frame {
    position: Position,
    mapping: bool,
    pending: Option<Key>,
    anchor: usize,
    start: usize,
}

struct Anchored {
    value: String,
    path: bool,
}

/// Visit every scalar of a pnpm lockfile with each base it must stay inside.
pub(crate) fn walk(text: &str, folder: &str, path: &str, check: &mut Check<'_>) -> Result<()> {
    let invalid = || Error::InvalidInput { path: path.into() };
    let mut parser = Parser::new_from_str(text);
    let mut frames: Vec<Frame> = Vec::new();
    let mut anchored: Vec<Anchored> = Vec::new();
    let mut anchors: BTreeMap<usize, (usize, usize)> = BTreeMap::new();
    let mut checked = BTreeSet::new();
    let mut open = 0usize;
    loop {
        let event = match parser.next_token() {
            Ok((event, _)) => event,
            Err(_) => return Err(invalid()),
        };
        match event {
            Event::StreamEnd => return Ok(()),
            Event::MappingStart(anchor, _) | Event::SequenceStart(anchor, _) => {
                let position = match frames.last() {
                    Some(frame) => frame.position.child(&slot(frame).unwrap_or(Key::Unknown)),
                    None => Position::default(),
                };
                open += usize::from(anchor != 0);
                frames.push(Frame {
                    position,
                    mapping: matches!(event, Event::MappingStart(..)),
                    pending: None,
                    anchor,
                    start: anchored.len(),
                });
            }
            Event::MappingEnd | Event::SequenceEnd => {
                let Some(frame) = frames.pop() else {
                    return Err(invalid());
                };
                if frame.anchor != 0 {
                    open -= 1;
                    anchors.insert(frame.anchor, (frame.start, anchored.len()));
                }
                complete(&mut frames, Key::Unknown);
            }
            Event::Scalar(value, _, anchor, _) => {
                let field = scalar(&frames, &value, folder, check)?;
                if anchor != 0 || open > 0 {
                    anchored.push(Anchored {
                        value: value.clone(),
                        path: field,
                    });
                    if anchor != 0 {
                        anchors.insert(anchor, (anchored.len() - 1, anchored.len()));
                    }
                }
                complete(&mut frames, Key::Name(value));
            }
            Event::Alias(anchor) => {
                let Some(&(start, end)) = anchors.get(&anchor) else {
                    return Err(invalid());
                };
                let field = frames.last().and_then(slot).is_some_and(|key| {
                    frames
                        .last()
                        .is_some_and(|frame| frame.position.child(&key).path())
                });
                if checked.insert((anchor, field)) {
                    for entry in &anchored[start..end] {
                        check(&entry.value, "", entry.path || field)?;
                    }
                }
                complete(&mut frames, Key::Unknown);
            }
            _ => {}
        }
    }
}

fn scalar(frames: &[Frame], value: &str, folder: &str, check: &mut Check<'_>) -> Result<bool> {
    let Some(frame) = frames.last() else {
        check(value, folder, false)?;
        return Ok(false);
    };
    let (position, key) = match slot(frame) {
        Some(key) => (frame.position.child(&key), true),
        None => (frame.position.clone(), false),
    };
    if !key && !position.unknown && position.depth == 1 && position.name(0) == Some("importers") {
        manifest::target(folder, value)?;
    }
    let field = key && position.path();
    for base in position.bases(key, value, folder)? {
        check(value, &base, field)?;
    }
    Ok(field)
}

fn slot(frame: &Frame) -> Option<Key> {
    if frame.mapping {
        frame.pending.clone()
    } else {
        Some(Key::Item)
    }
}

fn complete(frames: &mut [Frame], key: Key) {
    if let Some(frame) = frames.last_mut()
        && frame.mapping
    {
        frame.pending = match frame.pending {
            None => Some(key),
            Some(_) => None,
        };
    }
}
