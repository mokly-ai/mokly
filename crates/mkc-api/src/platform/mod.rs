//! Platform orchestration, transactional policies and DTO projections.

pub(crate) mod error;
mod execution;
mod grants;
pub(crate) mod initial_plan;
mod members;
mod policy;
pub(crate) mod project_access;
mod project_creation;
mod projection;
mod projects;
pub(crate) mod service;
mod slugs;
mod tokens;
mod transaction;
mod workspaces;

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
