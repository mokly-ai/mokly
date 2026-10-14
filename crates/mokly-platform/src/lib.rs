//! Operating-system boundaries used by output transactions and child runners.

#![warn(unreachable_pub)]

pub mod error;
pub mod locks;
pub mod processes;
pub mod rename;
#[cfg(unix)]
mod unix;
#[cfg(windows)]
mod windows;
