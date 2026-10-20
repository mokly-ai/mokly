//! The bounds that authored YAML must fit before Mokly decodes it further.
//!
//! Mokly enforces them while it reads parser events, before it copies or
//! traverses a decoded value.

/// The deepest level below the root of a YAML file that a value may sit at.
/// The root itself is level 0, and an alias counts at the depth of the
/// deepest value that it copies.
pub const MAX_DEPTH: usize = 128;

/// The most nodes that the aliases of one YAML file may expand to. An alias
/// expands to every node of its anchored value, mapping keys included.
pub const MAX_ALIAS_NODES: usize = 1_000_000;
