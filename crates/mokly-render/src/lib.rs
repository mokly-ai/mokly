//! Shared head and base JavaScript description, stylesheet, and rendering adapters.

#![warn(unreachable_pub)]

mod bundle;
mod declarations;
mod definition_input;
mod definitions;
mod diagnostics;
pub mod error;
mod fragments;
mod graph;
mod postcss;
mod postcss_inventory;
mod postcss_nested;
pub mod runtime;
pub mod side;
mod sources;
mod stylesheets;

#[cfg(test)]
#[path = "_tests_/nested_tests.rs"]
mod nested_tests;
#[cfg(test)]
#[path = "_tests_/postcss_tests.rs"]
mod postcss_tests;
