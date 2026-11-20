//! An isolated, verified Postgres schema scoped to a connection URL.

use std::env;

use diesel::sql_types::Text;
use diesel::{Connection, PgConnection, RunQueryDsl};
use url::Url;
use uuid::Uuid;

const DEFAULT_DATABASE_URL: &str = "postgres://postgres:postgres@localhost/mkc_test";

#[derive(Debug, diesel::QueryableByName)]
struct CurrentSchema {
    #[diesel(sql_type = Text)]
    name: String,
}

/// A unique schema whose scoped URL selects it as the current search path.
pub struct ScratchSchema {
    database_url: String,
    name: String,
    scoped_url: String,
}

impl ScratchSchema {
    /// Create and verify a scratch schema, or skip an unconfigured, unreachable database.
    ///
    /// An explicitly configured database or CI fails if Postgres is unreachable.
    pub fn create(prefix: &str) -> Option<Self> {
        let database_url =
            env::var("MKC_TEST_DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_owned());
        let mut connection = match PgConnection::establish(&database_url) {
            Ok(connection) => connection,
            Err(error) => {
                assert!(
                    env::var_os("MKC_TEST_DATABASE_URL").is_none() && env::var_os("CI").is_none(),
                    "Required Postgres integration database is unreachable: {error}"
                );
                eprintln!("SKIP {prefix}: Postgres is unreachable: {error}");
                return None;
            }
        };
        let name = format!("{prefix}_{}", Uuid::now_v7().simple());
        let scoped_url = scope_url(&database_url, &name);
        assert!(
            scoped_url.is_ok(),
            "Invalid Postgres integration database URL: {scoped_url:?}"
        );
        let Ok(scoped_url) = scoped_url else {
            return None;
        };
        let quoted_name = quoted_identifier(&name);
        let creation =
            diesel::sql_query(format!("CREATE SCHEMA {quoted_name}")).execute(&mut connection);
        assert!(creation.is_ok(), "Could not create {name}: {creation:?}");
        let schema = Self {
            database_url,
            name,
            scoped_url,
        };
        let scoped_connection = PgConnection::establish(schema.scoped_url());
        assert!(
            scoped_connection.is_ok(),
            "Could not connect with scratch URL: {:?}",
            scoped_connection.as_ref().err()
        );
        let Ok(mut scoped_connection) = scoped_connection else {
            return None;
        };
        let actual = diesel::sql_query("SELECT current_schema()::text AS name")
            .get_result::<CurrentSchema>(&mut scoped_connection);
        assert_eq!(
            actual.as_ref().ok().map(|row| row.name.as_str()),
            Some(schema.name()),
            "Scoped Postgres connection did not select scratch schema: {actual:?}"
        );
        Some(schema)
    }

    /// Connection URL with this schema selected as the default search path.
    pub fn scoped_url(&self) -> &str {
        &self.scoped_url
    }

    /// SQL schema name, suitable for naming other test-scoped artifacts.
    pub fn name(&self) -> &str {
        &self.name
    }
}

impl Drop for ScratchSchema {
    fn drop(&mut self) {
        match PgConnection::establish(&self.database_url) {
            Ok(mut connection) => {
                if let Err(error) = diesel::sql_query(format!(
                    "DROP SCHEMA {} CASCADE",
                    quoted_identifier(&self.name)
                ))
                .execute(&mut connection)
                {
                    eprintln!("Could not drop scratch schema {}: {error}", self.name);
                }
            }
            Err(error) => eprintln!(
                "Could not connect to drop scratch schema {}: {error}",
                self.name
            ),
        }
    }
}

fn quoted_identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn scope_url(database_url: &str, name: &str) -> Result<String, url::ParseError> {
    let mut database = Url::parse(database_url)?;
    database
        .query_pairs_mut()
        .append_pair("options", &format!("-csearch_path={name}"));
    Ok(database.to_string())
}

#[cfg(test)]
#[path = "_tests_/scratch_schema_tests.rs"]
mod scratch_schema_tests;
