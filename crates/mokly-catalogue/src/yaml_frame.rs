//! One open YAML sequence or mapping while the builder reads its children.

use mokly_model::catalogue::SourceLocation;
use serde_json::{Map, Value};
use yaml_rust2::parser::Event;

use crate::yaml_positions::Positions;
use crate::yaml_value::discard;

/// An open container, its position slot, and its anchor.
pub(crate) struct Frame {
    container: Container,
    /// The container's position slot; `None` inside a mapping key, whose
    /// locations are not kept.
    pub(crate) slot: Option<usize>,
    /// The container's anchor, or 0.
    pub(crate) anchor: usize,
    /// The location of the container's first event.
    pub(crate) start: SourceLocation,
}

enum Container {
    Sequence(Vec<Value>),
    /// A mapping, and the key, key location, and value slot awaiting a value.
    Mapping(
        Map<String, Value>,
        Option<(String, SourceLocation, Option<usize>)>,
    ),
}

/// Why a completed mapping key cannot be used.
pub(crate) enum Rejected {
    /// The key is not a string; the value is returned for stack-safe release.
    NotString(Value, SourceLocation),
    /// The key repeats an earlier key of the same mapping.
    Duplicate(String, SourceLocation),
}

impl Frame {
    /// Open a sequence or a mapping.
    pub(crate) fn new(
        sequence: bool,
        slot: Option<usize>,
        anchor: usize,
        start: SourceLocation,
    ) -> Self {
        let container = if sequence {
            Container::Sequence(Vec::new())
        } else {
            Container::Mapping(Map::new(), None)
        };
        Self {
            container,
            slot,
            anchor,
            start,
        }
    }

    /// The position slot of the next child node; `None` for a mapping key.
    pub(crate) fn child(&self, positions: &mut Positions) -> Option<usize> {
        match &self.container {
            Container::Sequence(values) => {
                let slot = self.slot?;
                Some(positions.child(slot, &values.len().to_string()))
            }
            Container::Mapping(_, Some((_, _, slot))) => *slot,
            Container::Mapping(_, None) => None,
        }
    }

    /// True when `event` ends this container where a container may end.
    pub(crate) fn closes(&self, event: &Event) -> bool {
        match (&self.container, event) {
            (Container::Sequence(_), Event::SequenceEnd) => true,
            (Container::Mapping(_, key), Event::MappingEnd) => key.is_none(),
            _ => false,
        }
    }

    /// Take the completed container's value.
    pub(crate) fn take(&mut self) -> Value {
        match &mut self.container {
            Container::Sequence(values) => Value::Array(std::mem::take(values)),
            Container::Mapping(values, _) => Value::Object(std::mem::take(values)),
        }
    }

    /// Add a completed child. A mapping child alternates between key and value;
    /// a value's position takes its key's location, as authors expect diagnostics.
    pub(crate) fn attach(
        &mut self,
        value: Value,
        start: SourceLocation,
        positions: &mut Positions,
    ) -> Result<(), Box<Rejected>> {
        let (values, key) = match &mut self.container {
            Container::Sequence(values) => {
                values.push(value);
                return Ok(());
            }
            Container::Mapping(values, key) => (values, key),
        };
        if let Some((name, location, slot)) = key.take() {
            if let Some(slot) = slot {
                positions.set(slot, location);
            }
            values.insert(name, value);
            return Ok(());
        }
        let Value::String(name) = value else {
            return Err(Box::new(Rejected::NotString(value, start)));
        };
        if values.contains_key(&name) {
            return Err(Box::new(Rejected::Duplicate(name, start)));
        }
        let slot = self.slot.map(|slot| {
            let segment = name.replace('~', "~0").replace('/', "~1");
            positions.child(slot, &segment)
        });
        *key = Some((name, start, slot));
        Ok(())
    }
}

impl Drop for Frame {
    fn drop(&mut self) {
        discard(self.take());
    }
}
