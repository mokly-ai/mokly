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
mod source_position;

#[cfg(test)]
#[path = "_tests_/compiler_tests.rs"]
mod compiler_tests;
#[cfg(test)]
#[path = "_tests_/module_diagnostics_tests.rs"]
mod module_diagnostics_tests;
#[cfg(test)]
#[path = "_tests_/modules_tests.rs"]
mod modules_tests;
#[cfg(test)]
#[path = "_tests_/resolver_tests.rs"]
mod resolver_tests;
#[cfg(test)]
#[path = "_tests_/syntax_tests.rs"]
mod syntax_tests;
#[cfg(test)]
#[path = "_tests_/wrapper_advice_tests.rs"]
mod wrapper_advice_tests;
#[cfg(test)]
#[path = "_tests_/wrapper_table_tests.rs"]
mod wrapper_table_tests;

pub mod parsed_cache;
pub mod rule_collection;
mod rule_syntax;
pub mod rules;

pub mod containment;
pub mod match_tree;
pub mod rule_matching;
mod selector_element;
mod selector_impl;
mod selector_scope;

pub mod attribution;

#[cfg(test)]
#[path = "_tests_/rule_tests.rs"]
mod rule_tests;

pub mod inline_attribution;

pub mod observation;

#[cfg(test)]
#[path = "_tests_/attribution_tests.rs"]
mod attribution_tests;

mod compiler_assets;
mod css_boundaries;
mod selector_nesting;

mod lookup_roots;

mod rename_rules;
mod rule_walk;
mod token_grammar;
mod token_sections;
mod token_statement;
mod token_tree;

#[cfg(test)]
#[path = "_tests_/deep_scanner_tests.rs"]
mod deep_scanner_tests;
