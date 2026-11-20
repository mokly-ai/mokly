//! Partial startup stops the child and its descendant before ownership ends.

#[cfg(unix)]
mod partial_start;
