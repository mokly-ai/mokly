//! Diesel queries and row mapping for users.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::authentication::users;
use mkc_domain::ids::UserId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::user::{User, Users};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = users)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
struct Row {
    id: Uuid,
    email: String,
    name: String,
    created_at: DateTime<Utc>,
}

impl Row {
    fn dto(self) -> Result<User> {
        Ok(User {
            id: self.id.into(),
            email: self.email,
            name: self.name,
            created_at: self.created_at,
        })
    }

    fn record(value: &User) -> Self {
        Self {
            id: value.id.0,
            email: value.email.clone(),
            name: value.name.clone(),
            created_at: value.created_at,
        }
    }
}

impl Users for PgQueries<'_> {
    fn user(&mut self, id: UserId) -> Result<Option<User>> {
        users::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read users")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_user(&mut self, value: &User) -> Result<()> {
        diesel::insert_into(users::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert users")?;
        Ok(())
    }

    fn save_user(&mut self, value: &User) -> Result<()> {
        let row = Row::record(value);
        diesel::update(users::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update users")?;
        Ok(())
    }

    fn delete_user(&mut self, id: UserId) -> Result<()> {
        diesel::delete(users::table.find(id.0))
            .execute(self.connection)
            .context("delete users")?;
        Ok(())
    }

    fn find_user(&mut self, email: &str) -> Result<Option<User>> {
        users::table
            .filter(users::email.eq(email))
            .order(users::id.asc())
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("find users")?
            .map(Row::dto)
            .transpose()
    }
}
