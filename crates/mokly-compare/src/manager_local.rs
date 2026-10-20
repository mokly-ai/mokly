//! Check YAML dependency paths without expanding aliases or checking overridden store paths.

use std::collections::BTreeMap;
use std::sync::Arc;

use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};
use crate::local_specifications;
use crate::manifest;

#[derive(Clone, Default)]
struct Evidence {
    path: Option<Arc<str>>,
    specification: Option<Arc<str>>,
}

impl Evidence {
    fn scalar(parent: &str, value: &str) -> Result<Self> {
        let specification = match local_specifications::validate(value, parent, parent) {
            Ok(()) => None,
            Err(Error::LocalOutside { path }) => Some(Arc::from(path)),
            Err(error) => return Err(error),
        };
        Ok(Self {
            path: manifest::target(parent, value.trim_start_matches('!'))
                .err()
                .map(|_| Arc::from(value.trim_start_matches('!'))),
            specification,
        })
    }

    fn merge(&mut self, other: Self) {
        self.path = self.path.take().or(other.path);
        self.specification = self.specification.take().or(other.specification);
    }

    fn validate(&self, parent: &str, key: Option<&str>) -> Result<()> {
        let rejected = match key {
            Some("packages" | "patchedDependencies") => &self.path,
            Some("overrides" | "catalog" | "catalogs" | "packageExtensions") => &self.specification,
            _ => return Ok(()),
        };
        if let Some(path) = rejected {
            manifest::target(parent, path)?;
        }
        Ok(())
    }
}

struct Frame {
    anchor: usize,
    evidence: Evidence,
}

pub(crate) fn validate(bytes: &[u8], path: &str) -> Result<()> {
    let invalid = || Error::InvalidInput { path: path.into() };
    let text = match str::from_utf8(bytes) {
        Ok(text) => text,
        Err(_) => return Err(invalid()),
    };
    let parent = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    let mut parser = Parser::new_from_str(text);
    let mut frames: Vec<Frame> = Vec::new();
    let mut anchors: BTreeMap<usize, Evidence> = BTreeMap::new();
    let mut key = None;
    loop {
        let event = match parser.next_token() {
            Ok((event, _)) => event,
            Err(_) => return Err(invalid()),
        };
        let evidence = match event {
            Event::StreamEnd => return Ok(()),
            Event::MappingStart(anchor, _) | Event::SequenceStart(anchor, _) => {
                frames.push(Frame {
                    anchor,
                    evidence: Evidence::default(),
                });
                continue;
            }
            Event::MappingEnd | Event::SequenceEnd => {
                let Some(frame) = frames.pop() else {
                    return Err(invalid());
                };
                if frame.anchor != 0 {
                    anchors.insert(frame.anchor, frame.evidence.clone());
                }
                if frames.len() == 1 {
                    key = None;
                }
                frame.evidence
            }
            Event::Scalar(value, _, anchor, _) => {
                let evidence = Evidence::scalar(parent, &value)?;
                if anchor != 0 {
                    anchors.insert(anchor, evidence.clone());
                }
                if frames.len() == 1 && key.is_none() {
                    key = Some(value);
                    continue;
                }
                evidence.validate(parent, key.as_deref())?;
                if frames.len() == 1 {
                    key = None;
                }
                evidence
            }
            Event::Alias(anchor) => {
                let Some(evidence) = anchors.get(&anchor).cloned() else {
                    return Err(invalid());
                };
                evidence.validate(parent, key.as_deref())?;
                if frames.len() == 1 {
                    key = None;
                }
                evidence
            }
            _ => continue,
        };
        if let Some(frame) = frames.last_mut() {
            frame.evidence.merge(evidence);
        }
    }
}
