//! The bounds that authored YAML must fit before Mokly decodes it further.
//!
//! The front-matter builder enforces them while it reads parser events, so
//! no recursive traversal ever sees a value outside them.

/// The deepest level below the root of a YAML file that a value may sit at.
/// The root itself is level 0, and an alias counts at the depth of the
/// deepest value that it copies.
pub const MAX_DEPTH: usize = 128;
