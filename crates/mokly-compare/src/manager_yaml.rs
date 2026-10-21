//! Streaming projection of YAML root keys without alias expansion or recursive values.

use std::collections::BTreeMap;

use yaml_rust2::parser::{Event, Parser};

use crate::error::{Error, Result};

pub(crate) fn fields(bytes: &[u8], path: &str) -> Result<BTreeMap<String, Option<String>>> {
    let invalid = || Error::InvalidInput { path: path.into() };
    let text = match str::from_utf8(bytes) {
        Ok(text) => text,
        Err(_) => return Err(invalid()),
    };
    let mut parser = Parser::new_from_str(text);
    let mut depth = 0usize;
    let mut key = None;
    let mut fields = BTreeMap::new();
    loop {
        let event = match parser.next_token() {
            Ok((event, _)) => event,
            Err(_) => return Err(invalid()),
        };
        match event {
            Event::StreamEnd => return Ok(fields),
            Event::MappingStart(_, _) | Event::SequenceStart(_, _) => {
                if depth == 1 {
                    let Some(name) = key.take() else {
                        return Err(invalid());
                    };
                    if fields.insert(name, None).is_some() {
                        return Err(invalid());
                    }
                }
                depth += 1;
            }
            Event::MappingEnd | Event::SequenceEnd => depth = depth.saturating_sub(1),
            Event::Scalar(value, _, _, _) if depth == 1 => {
                if let Some(name) = key.take() {
                    if fields.insert(name, Some(value)).is_some() {
                        return Err(invalid());
                    }
                } else {
                    key = Some(value);
                }
            }
            Event::Alias(_) if depth == 1 => return Err(invalid()),
            _ => {}
        }
    }
}
