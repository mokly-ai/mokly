//! Check authored alternatives with one path state per distinct safety outcome.

use std::collections::BTreeMap;
use std::collections::btree_map::Entry;

#[derive(Clone, Copy, Default, Eq, Ord, PartialEq, PartialOrd)]
enum Segment {
    #[default]
    Start,
    OmittedStart,
    Whitespace,
    Empty,
    Omitted,
    Dot,
    DotDot,
    Other,
}

impl Segment {
    fn omitted(self) -> bool {
        matches!(self, Self::OmittedStart | Self::Omitted)
    }
}

#[derive(Clone, Copy, Default, Eq, Ord, PartialEq, PartialOrd)]
struct State {
    segment: Segment,
    invalid: bool,
}

impl State {
    fn push(self, character: char) -> Option<Self> {
        let segment = self.segment;
        if character == '/' {
            return (!segment.omitted()).then_some(Self {
                segment: Segment::Empty,
                invalid: self.invalid || !matches!(segment, Segment::Other | Segment::Whitespace),
            });
        }
        let at_start = matches!(segment, Segment::Start | Segment::OmittedStart);
        let next = match character {
            '.' if at_start || matches!(segment, Segment::Empty | Segment::Omitted) => Segment::Dot,
            '.' if segment == Segment::Dot => Segment::DotDot,
            character
                if character.is_whitespace() && (at_start || segment == Segment::Whitespace) =>
            {
                Segment::Whitespace
            }
            _ => Segment::Other,
        };
        Some(Self {
            segment: next,
            invalid: self.invalid || (at_start && matches!(character, '!' | '#')),
        })
    }

    fn omit(self) -> Self {
        Self {
            segment: match self.segment {
                Segment::Start => Segment::OmittedStart,
                Segment::Empty => Segment::Omitted,
                segment => segment,
            },
            ..self
        }
    }

    fn unsafe_path(self) -> bool {
        !self.segment.omitted() && (self.invalid || self.segment != Segment::Other)
    }
}

type States = BTreeMap<State, Option<usize>>;

struct Step {
    previous: Option<usize>,
    character: char,
}

pub(super) struct Branches {
    start: States,
    end: States,
}

pub(super) struct Validation {
    active: States,
    steps: Vec<Step>,
}

impl Default for Validation {
    fn default() -> Self {
        Self {
            active: States::from([(State::default(), None)]),
            steps: Vec::new(),
        }
    }
}

impl Validation {
    pub(super) fn push(&mut self, character: char) {
        let mut next = States::new();
        for (&state, &previous) in &self.active {
            if let Some(state) = state.push(character)
                && let Entry::Vacant(entry) = next.entry(state)
            {
                entry.insert(Some(self.steps.len()));
                self.steps.push(Step {
                    previous,
                    character,
                });
            }
        }
        self.active = next;
    }

    pub(super) fn open(&self) -> Branches {
        Branches {
            start: self.active.clone(),
            end: States::new(),
        }
    }

    pub(super) fn branch(&mut self, branches: &mut Branches) {
        merge(&mut branches.end, &self.active);
        self.active.clone_from(&branches.start);
    }

    pub(super) fn close(&mut self, mut branches: Branches, optional: bool) {
        merge(&mut branches.end, &self.active);
        if optional {
            for (state, step) in branches.start {
                branches.end.entry(state.omit()).or_insert(step);
            }
        }
        self.active = branches.end;
    }

    pub(super) fn unsafe_alternative(&self) -> Option<String> {
        let (_, &last) = self.active.iter().find(|(state, _)| state.unsafe_path())?;
        let mut next = last;
        let mut characters = Vec::new();
        while let Some(index) = next {
            let step = &self.steps[index];
            characters.push(step.character);
            next = step.previous;
        }
        Some(characters.into_iter().rev().collect())
    }
}

fn merge(target: &mut States, source: &States) {
    for (&state, &step) in source {
        target.entry(state).or_insert(step);
    }
}
