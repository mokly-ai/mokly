//! Typed platform persistence boundaries.

#![warn(unreachable_pub)]

pub mod billing_checkout;
pub mod billing_customer;
pub mod billing_delivery;
pub mod billing_seat_command;
pub mod billing_state;
pub mod billing_subscription;
pub mod blob;
pub mod build;
pub mod build_attempt;
pub mod build_check;
pub mod build_clock;
pub mod build_grant;
pub mod build_history;
pub mod build_log;
pub mod build_state;
pub mod error;
pub mod grant;
pub mod integration;
pub mod magic_link;
pub mod member;
pub mod organization;
pub mod project;
pub mod publication;
pub mod publication_changes;
pub mod publication_event;
pub mod publication_screens;
pub mod rate_limit;
pub mod session;
pub mod store;
pub mod token;
pub mod user;
pub mod viewer;

pub mod github_check;
pub mod github_delivery;
pub mod github_identity;
pub mod github_installation;
pub mod github_refs;
pub mod github_repository;
pub mod github_retention;
pub mod github_state;
