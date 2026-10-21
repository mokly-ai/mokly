//! Workspace pattern confinement through every brace and `**` expansion.
//!
//! One pass reads the pattern. For each partial-segment state it keeps only
//! the lowest folder depth that some expansion reaches, so the work grows
//! linearly with the pattern and builds no expansion list. A brace group
//! pairs with its nearest unmatched open brace, as brace expansion pairs it.
//! Every group is an alternation: a single alternative never pops more than
//! its literal reading. `**` counts as zero folders, its lowest depth.

use std::collections::BTreeMap;

use crate::error::{Error, Result};

#[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
enum Segment {
    Empty,
    Dot,
    DotDot,
    Star,
    StarStar,
    Tilde,
    Other,
}

/// The partial segment, whether it is the first segment, and whether the
/// expansion is still empty.
#[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
struct State {
    segment: Segment,
    first: bool,
    blank: bool,
}

type States = BTreeMap<State, usize>;

struct Group {
    input: States,
    output: States,
    end: usize,
}

/// Reject a pattern when any expansion leaves the repository from `parent`.
pub(crate) fn confine(parent: &str, pattern: &str) -> Result<()> {
    let outside = || Error::LocalOutside {
        path: pattern.to_owned(),
    };
    if pattern.contains(['\\', ':', '%', '\0']) {
        return Err(outside());
    }
    let bytes = pattern.as_bytes();
    let ends = pairs(bytes);
    let start = State {
        segment: Segment::Empty,
        first: true,
        blank: true,
    };
    let depth = parent.split('/').filter(|part| !part.is_empty()).count();
    let mut current = States::from([(start, depth)]);
    let mut groups: Vec<Group> = Vec::new();
    for (index, byte) in bytes.iter().enumerate() {
        if let Some(end) = ends[index] {
            groups.push(Group {
                input: current.clone(),
                output: States::new(),
                end,
            });
            continue;
        }
        if let Some(group) = groups.last_mut() {
            if *byte == b',' {
                merge(&mut group.output, &current);
                current = group.input.clone();
                continue;
            }
            if index == group.end
                && let Some(mut group) = groups.pop()
            {
                merge(&mut group.output, &current);
                current = group.output;
                continue;
            }
        }
        current = step(&current, *byte).ok_or_else(outside)?;
    }
    for (state, depth) in current {
        if state.blank
            || (state.first && state.segment == Segment::Tilde)
            || finish(state.segment, depth).is_none()
        {
            return Err(outside());
        }
    }
    Ok(())
}

fn pairs(bytes: &[u8]) -> Vec<Option<usize>> {
    let mut ends = vec![None; bytes.len()];
    let mut open = Vec::new();
    for (index, byte) in bytes.iter().enumerate() {
        match byte {
            b'{' => open.push(index),
            b'}' => {
                if let Some(start) = open.pop() {
                    ends[start] = Some(index);
                }
            }
            _ => {}
        }
    }
    ends
}

fn merge(target: &mut States, states: &States) {
    for (state, depth) in states {
        insert(target, *state, *depth);
    }
}

fn insert(target: &mut States, state: State, depth: usize) {
    target
        .entry(state)
        .and_modify(|lowest| *lowest = (*lowest).min(depth))
        .or_insert(depth);
}

fn step(states: &States, byte: u8) -> Option<States> {
    let mut next = States::new();
    for (state, depth) in states {
        let (state, depth) = if byte == b'/' {
            if state.blank || (state.first && state.segment == Segment::Tilde) {
                return None;
            }
            let next = State {
                segment: Segment::Empty,
                first: false,
                blank: false,
            };
            (next, finish(state.segment, *depth)?)
        } else {
            let next = State {
                segment: grow(state.segment, byte),
                first: state.first,
                blank: false,
            };
            (next, *depth)
        };
        insert(&mut next, state, depth);
    }
    Some(next)
}

fn grow(segment: Segment, byte: u8) -> Segment {
    match (segment, byte) {
        (Segment::Empty, b'.') => Segment::Dot,
        (Segment::Dot, b'.') => Segment::DotDot,
        (Segment::Empty, b'*') => Segment::Star,
        (Segment::Star, b'*') => Segment::StarStar,
        (Segment::Empty, b'~') => Segment::Tilde,
        _ => Segment::Other,
    }
}

fn finish(segment: Segment, depth: usize) -> Option<usize> {
    match segment {
        Segment::Empty | Segment::Dot | Segment::StarStar => Some(depth),
        Segment::DotDot => depth.checked_sub(1),
        Segment::Star | Segment::Tilde | Segment::Other => Some(depth.saturating_add(1)),
    }
}
