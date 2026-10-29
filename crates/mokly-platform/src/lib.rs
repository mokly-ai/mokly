//! Operating-system boundaries used by output transactions and child runners.

#![warn(unreachable_pub)]

pub mod error;
pub mod flush;
pub mod locks;
pub mod processes;
pub mod rename;
#[cfg(unix)]
mod unix;
#[cfg(all(unix, any(target_os = "macos", test)))]
mod unix_group_members;
#[cfg(unix)]
mod unix_process_table;
#[cfg(unix)]
mod unix_process_tree;
#[cfg(windows)]
mod windows;
