//! Stylesheet delivery, asset rewriting, and stable CSS Modules.
#![warn(unreachable_pub)]

pub mod compiler;
pub mod dependencies;
pub mod error;
pub mod modules;
pub mod names;
pub mod paths;
pub mod resolution;
pub mod resolver;
pub mod syntax;
pub mod types;

mod delivery;
mod module_checks;
mod module_integrity;
mod package;
mod rename;
mod rename_animations;
mod rename_output;
mod rename_selectors;

#[cfg(test)]
#[path = "_tests_/compiler_tests.rs"]
mod compiler_tests;
#[cfg(test)]
#[path = "_tests_/modules_tests.rs"]
mod modules_tests;
#[cfg(test)]
#[path = "_tests_/resolver_tests.rs"]
mod resolver_tests;
#[cfg(test)]
#[path = "_tests_/syntax_tests.rs"]
mod syntax_tests;

mod compiler_assets;
