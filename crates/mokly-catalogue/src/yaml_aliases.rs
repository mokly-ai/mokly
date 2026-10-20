//! One scan of the parser events that bounds alias expansion before any copy.
//!
//! An alias decodes as a copy of its anchored value, so a short chain of
//! aliases can expand to billions of nodes. The scan counts the nodes that
//! each anchored value holds and that each alias expands to, without copying
//! a value, and it names the anchors that the builder must keep.

use std::collections::{BTreeMap, BTreeSet};

use yaml_rust2::parser::{Event, Parser};
use yaml_rust2::scanner::Marker;

use crate::yaml_limits::MAX_DEPTH;

/// The anchors that an alias refers to, or the location of the alias whose
/// expansion passes `budget` nodes. The scan stops without a failure where
/// the builder fails first: at a parser error, at a value deeper than
/// [`MAX_DEPTH`], and at the end of the first document.
pub(crate) fn scan(text: &str, budget: usize) -> Result<BTreeSet<usize>, Marker> {
    let mut parser = Parser::new_from_str(text);
    let mut sizes: BTreeMap<usize, usize> = BTreeMap::new();
    let mut open: Vec<(usize, usize)> = Vec::new();
    let mut aliased = BTreeSet::new();
    let mut expanded = 0_usize;
    while let Ok((event, marker)) = parser.next_token() {
        let node = matches!(
            event,
            Event::Scalar(..)
                | Event::Alias(_)
                | Event::SequenceStart(..)
                | Event::MappingStart(..)
        );
        if node && open.len() > MAX_DEPTH {
            break;
        }
        let (anchor, nodes) = match event {
            Event::SequenceStart(anchor, _) | Event::MappingStart(anchor, _) => {
                open.push((anchor, 1));
                continue;
            }
            Event::SequenceEnd | Event::MappingEnd => match open.pop() {
                Some(closed) => closed,
                None => continue,
            },
            Event::Scalar(_, _, anchor, _) => (anchor, 1),
            Event::Alias(anchor) => {
                aliased.insert(anchor);
                let nodes = sizes.get(&anchor).copied().unwrap_or_default();
                expanded = expanded.saturating_add(nodes);
                if expanded > budget {
                    return Err(marker);
                }
                (0, nodes)
            }
            Event::DocumentEnd | Event::StreamEnd => break,
            _ => continue,
        };
        if anchor != 0 {
            sizes.insert(anchor, nodes);
        }
        if let Some(parent) = open.last_mut() {
            parent.1 = parent.1.saturating_add(nodes);
        }
    }
    Ok(aliased)
}

#[cfg(test)]
#[path = "_tests_/yaml_aliases_tests.rs"]
mod yaml_aliases_tests;
