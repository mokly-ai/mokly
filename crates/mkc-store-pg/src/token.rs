//! Diesel queries and row mapping for project_tokens.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::platform::project_tokens;
use mkc_domain::ids::{ProjectId, TokenId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::token::{Token, Tokens};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = project_tokens)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
struct Row {
    id: Uuid,
    project_id: Uuid,
    name: String,
    prefix: String,
    token_hash: String,
    created_at: DateTime<Utc>,
    last_used_at: Option<DateTime<Utc>>,
    revoked_at: Option<DateTime<Utc>>,
}

impl Row {
    fn dto(self) -> Result<Token> {
        Ok(Token {
            id: self.id.into(),
            project_id: self.project_id.into(),
            name: self.name,
            prefix: self.prefix,
            token_hash: self.token_hash,
            created_at: self.created_at,
            last_used_at: self.last_used_at,
            revoked_at: self.revoked_at,
        })
    }

    fn record(value: &Token) -> Self {
        Self {
            id: value.id.0,
            project_id: value.project_id.0,
            name: value.name.clone(),
            prefix: value.prefix.clone(),
            token_hash: value.token_hash.clone(),
            created_at: value.created_at,
            last_used_at: value.last_used_at,
            revoked_at: value.revoked_at,
        }
    }
}

impl Tokens for PgQueries<'_> {
    fn token_by_hash(&mut self, digest: &str) -> Result<Option<Token>> {
        project_tokens::table
            .filter(project_tokens::token_hash.eq(digest))
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("lookup project bearer digest")?
            .map(Row::dto)
            .transpose()
    }

    fn token(&mut self, id: TokenId) -> Result<Option<Token>> {
        project_tokens::table
            .find(id.0)
            .select(Row::as_select())
            .first(self.connection)
            .optional()
            .context("read project_tokens")?
            .map(Row::dto)
            .transpose()
    }

    fn insert_token(&mut self, value: &Token) -> Result<()> {
        diesel::insert_into(project_tokens::table)
            .values(Row::record(value))
            .execute(self.connection)
            .context("insert project_tokens")?;
        Ok(())
    }

    fn save_token(&mut self, value: &Token) -> Result<()> {
        let row = Row::record(value);
        diesel::update(project_tokens::table.find(&row.id))
            .set(&row)
            .execute(self.connection)
            .context("update project_tokens")?;
        Ok(())
    }

    fn tokens(&mut self, project: ProjectId) -> Result<Vec<Token>> {
        project_tokens::table
            .filter(project_tokens::project_id.eq(project.0))
            .order(project_tokens::id.asc())
            .select(Row::as_select())
            .load(self.connection)
            .context("list project_tokens")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
