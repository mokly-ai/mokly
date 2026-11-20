//! User persistence data and query boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::UserId;

use crate::error::Result;

/// Persisted user data; secret-bearing records are never serialized.
#[derive(Clone, Debug)]
pub struct User {
    /// Stored id.
    pub id: UserId,
    /// Stored email.
    pub email: String,
    /// Stored name.
    pub name: String,
    /// Stored created at.
    pub created_at: DateTime<Utc>,
}

/// Queries for users within the caller's transaction.
#[unimock::unimock(api = UsersMock)]
pub trait Users {
    /// Execute the user query.
    fn user(&mut self, id: UserId) -> Result<Option<User>>;
    /// Execute the insert user query.
    fn insert_user(&mut self, value: &User) -> Result<()>;
    /// Execute the save user query.
    fn save_user(&mut self, value: &User) -> Result<()>;
    /// Execute the delete user query.
    fn delete_user(&mut self, id: UserId) -> Result<()>;
    /// Execute the find user query.
    fn find_user(&mut self, email: &str) -> Result<Option<User>>;
}
