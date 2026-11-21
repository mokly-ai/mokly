//! Read-only database evidence from the command's isolated schema.

use diesel::sql_types::{BigInt, Text};
use diesel::{Connection, PgConnection, RunQueryDsl};
use serde_json::Value;

use super::frozen::HEAD;
use super::harness::Harness;

#[derive(Debug, diesel::QueryableByName)]
pub(crate) struct Counts {
    #[diesel(sql_type = BigInt)]
    pub(crate) users: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) workspaces: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) projects: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) tokens: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) live_tokens: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) publications: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) ready: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) sessions: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) repository_links: i64,
    #[diesel(sql_type = BigInt)]
    pub(crate) subscriptions: i64,
}

#[derive(diesel::QueryableByName)]
struct Scalar {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[derive(diesel::QueryableByName)]
struct Publication {
    #[diesel(sql_type = Text)]
    project: String,
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Text)]
    head_sha: String,
    #[diesel(sql_type = Text)]
    state: String,
    #[diesel(sql_type = Text)]
    pull_request: String,
    #[diesel(sql_type = Text)]
    plan: String,
    #[diesel(sql_type = Text)]
    visibility: String,
    #[diesel(sql_type = Text)]
    repository: String,
    #[diesel(sql_type = Text)]
    config_path: String,
}

impl Harness {
    pub(crate) fn counts(&self) -> Counts {
        diesel::sql_query(
            "SELECT
            (SELECT count(*) FROM users) AS users,
            (SELECT count(*) FROM organizations) AS workspaces,
            (SELECT count(*) FROM projects) AS projects,
            (SELECT count(*) FROM project_tokens) AS tokens,
            (SELECT count(*) FROM project_tokens WHERE revoked_at IS NULL) AS live_tokens,
            (SELECT count(*) FROM publications) AS publications,
            (SELECT count(*) FROM publications WHERE state = 'ready') AS ready,
            (SELECT count(*) FROM sessions) AS sessions,
            (SELECT count(*) FROM github_project_repositories) AS repository_links,
            (SELECT count(*) FROM billing_subscriptions) AS subscriptions",
        )
        .get_result(&mut self.connection())
        .unwrap()
    }

    pub(crate) fn table_count(&self) -> i64 {
        diesel::sql_query("SELECT count(*) FROM pg_tables WHERE schemaname = current_schema()")
            .get_result::<Scalar>(&mut self.connection())
            .unwrap()
            .count
    }

    pub(crate) fn assert_publication(&self, proof: &Value, pr: Option<u32>) {
        let record = diesel::sql_query(
            "SELECT publications.project_id::text AS project, publications.id::text,
            head_sha, state, coalesce(pull_request::text, 'null') AS pull_request,
            organizations.plan, projects.visibility, projects.repository, projects.config_path
            FROM publications JOIN projects ON projects.id = publications.project_id
            JOIN organizations ON organizations.id = projects.organization_id
            WHERE state = 'ready'",
        )
        .get_result::<Publication>(&mut self.connection())
        .unwrap();
        assert_eq!(record.project, proof["projectId"].as_str().unwrap());
        assert_eq!(record.id, proof["publicationId"].as_str().unwrap());
        assert_eq!(record.head_sha, HEAD);
        assert_eq!(record.state, "ready");
        assert_eq!(record.plan, "team");
        assert_eq!(record.visibility, "public");
        assert_eq!(record.repository, "mokly-ai/mokly");
        assert_eq!(record.config_path, "mokly.config.json");
        assert_eq!(
            record.pull_request,
            pr.map_or_else(|| "null".to_owned(), |pr| pr.to_string())
        );
    }

    fn connection(&self) -> PgConnection {
        PgConnection::establish(self.database.scoped_url()).unwrap()
    }
}
