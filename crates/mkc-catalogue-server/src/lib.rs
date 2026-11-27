//! mkc-catalogue-server boundary.

#![warn(unreachable_pub)]

pub mod application;
mod cache;
mod cache_fill;
mod catalogue;
mod compression;
mod conditional;
mod delivery;
mod embedded_access;
pub mod error;
mod file_response;
mod http;
mod range;
mod response;
mod router;
mod routes;

#[cfg(test)]
#[path = "_tests_/support.rs"]
mod test_support;
