//! Yarn Berry configuration ranges confined like manifest specifications.
//!
//! The `catalog`, `catalogs`, and `packageExtensions` settings add dependency
//! ranges. Every scalar in them, and every aliased scalar that they use, gets
//! the manifest checks from the configuration folder. That folder is at or
//! above each workspace that uses the range, so it is the stricter base.

use std::collections::{BTreeMap, BTreeSet};

use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::local_specifications;

const RANGES: [&str; 3] = ["catalog", "catalogs", "packageExtensions"];

struct Frame {
    mapping: bool,
    key: bool,
    name: Option<String>,
    range: bool,
    anchor: usize,
    start: usize,
}

/// Check the range settings of one `.yarnrc.yml` from its folder and project.
pub(crate) fn validate(bytes: &[u8], path: &str, directory: &str, project: &str) -> Result<()> {
    let invalid = || Error::InvalidInput { path: path.into() };
    let Ok(text) = str::from_utf8(bytes) else {
        return Err(invalid());
    };
    let check = |value: &str| local_specifications::validate(value, directory, project);
    let mut parser = Parser::new_from_str(text);
    let mut frames: Vec<Frame> = Vec::new();
    let mut scalars: Vec<String> = Vec::new();
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
                let range = range(&frames);
                open += usize::from(anchor != 0);
                frames.push(Frame {
                    mapping: matches!(event, Event::MappingStart(..)),
                    key: true,
                    name: None,
                    range,
                    anchor,
                    start: scalars.len(),
                });
            }
            Event::MappingEnd | Event::SequenceEnd => {
                let Some(frame) = frames.pop() else {
                    return Err(invalid());
                };
                if frame.anchor != 0 {
                    open -= 1;
                    anchors.insert(frame.anchor, (frame.start, scalars.len()));
                }
                complete(&mut frames, None);
            }
            Event::Scalar(value, _, anchor, _) => {
                if range(&frames) {
                    check(&value)?;
                }
                if anchor != 0 || open > 0 {
                    scalars.push(value.clone());
                    if anchor != 0 {
                        anchors.insert(anchor, (scalars.len() - 1, scalars.len()));
                    }
                }
                complete(&mut frames, Some(value));
            }
            Event::Alias(anchor) => {
                let Some(&(start, end)) = anchors.get(&anchor) else {
                    return Err(invalid());
                };
                if range(&frames) && checked.insert(anchor) {
                    scalars[start..end]
                        .iter()
                        .try_for_each(|value| check(value))?;
                }
                complete(&mut frames, None);
            }
            _ => {}
        }
    }
}

fn range(frames: &[Frame]) -> bool {
    match frames {
        [] => false,
        [root] => {
            root.mapping
                && !root.key
                && root
                    .name
                    .as_deref()
                    .is_some_and(|name| RANGES.contains(&name))
        }
        [.., parent] => parent.range,
    }
}

fn complete(frames: &mut [Frame], name: Option<String>) {
    if let Some(frame) = frames.last_mut()
        && frame.mapping
    {
        frame.name = if frame.key { name } else { None };
        frame.key = !frame.key;
    }
}
