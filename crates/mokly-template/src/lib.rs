//! Compile and render the template text of Mokly HTML bodies.
#![warn(unreachable_pub)]
#![forbid(unsafe_code)]

pub mod analysis;
pub mod engine;
pub mod error;
pub mod rendered;

mod analysis_expressions;
mod context;
mod forbidden;
mod format;
mod html_attributes;
mod lexer;
mod lowering;
mod settings;
mod source_map;

#[cfg(test)]
#[path = "_tests_/analysis_tests.rs"]
mod analysis_tests;
#[cfg(test)]
#[path = "_tests_/lowering_tests.rs"]
mod lowering_tests;
#[cfg(test)]
#[path = "_tests_/render_tests.rs"]
mod render_tests;
