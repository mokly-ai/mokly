//! Forward slug backfill and rollback against the real Postgres engine.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Text};
use mkc_test_pg::scratch_schema::ScratchSchema;

#[derive(QueryableByName)]
struct SlugRow {
    #[diesel(sql_type = Text)]
    slug: String,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

struct TestDatabase {
    connection: PgConnection,
    _schema: ScratchSchema,
}

fn database() -> Option<TestDatabase> {
    let schema = ScratchSchema::create("slug_migration")?;
    let connection = PgConnection::establish(schema.scoped_url()).unwrap();
    Some(TestDatabase {
        connection,
        _schema: schema,
    })
}

fn slugs(connection: &mut PgConnection, table: &str) -> Vec<String> {
    diesel::sql_query(format!("SELECT slug FROM {table} ORDER BY id"))
        .load::<SlugRow>(connection)
        .unwrap()
        .into_iter()
        .map(|row| row.slug)
        .collect()
}

fn count(connection: &mut PgConnection, query: &str) -> i64 {
    diesel::sql_query(query)
        .get_result::<CountRow>(connection)
        .unwrap()
        .count
}

fn assert_claims_match_current_subjects(connection: &mut PgConnection) {
    assert_eq!(
        count(
            connection,
            r#"SELECT count(*) AS count
               FROM organizations o
               FULL OUTER JOIN organization_slugs s
                 ON s.slug = o.slug AND s.organization_id = o.id
               WHERE o.id IS NULL OR s.organization_id IS NULL"#,
        ),
        0
    );
    assert_eq!(
        count(
            connection,
            r#"SELECT count(*) AS count
               FROM projects p
               FULL OUTER JOIN project_slugs s
                 ON s.organization_id = p.organization_id
                AND s.slug = p.slug AND s.project_id = p.id
               WHERE p.id IS NULL OR s.project_id IS NULL"#,
        ),
        0
    );
}

#[test]
fn backfill_is_scoped_deterministic_and_reversible() {
    let Some(mut database) = database() else {
        return;
    };
    let connection = &mut database.connection;
    connection
        .batch_execute(include_str!("../migrations/202609161100_platform/up.sql"))
        .unwrap();
    connection
        .batch_execute(
            r#"
            INSERT INTO organizations (id, name, version, created_at) VALUES
              ('00000000-0000-7000-8000-000000000001', 'admin', 1, now()),
              ('00000000-0000-7000-8000-000000000002', 'admin', 1, now()),
              ('00000000-0000-7000-8000-000000000003', '00000000-0000-0000-0000-000000000001', 1, now()),
              ('00000000-0000-7000-8000-000000000004', '00000000000000000000000000000001', 1, now()),
              ('00000000-0000-7000-8000-000000000005', '🙂', 1, now()),
              ('00000000-0000-7000-8000-000000000006', repeat('a', 80), 1, now()),
              ('00000000-0000-7000-8000-000000000007', repeat('a', 80), 1, now()),
              ('00000000-0000-7000-8000-000000000008', 'Ｆoo—Bar', 1, now()),
              ('00000000-0000-7000-8000-000000000009', repeat('c', 38) || ' d', 1, now());
            INSERT INTO projects
              (id, organization_id, name, repository, config_path, visibility, version)
            VALUES
              ('00000000-0000-7000-8000-000000000101', '00000000-0000-7000-8000-000000000001', 'admin', 'a/one', 'one.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000102', '00000000-0000-7000-8000-000000000001', 'admin', 'a/two', 'two.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000103', '00000000-0000-7000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'a/three', 'three.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000104', '00000000-0000-7000-8000-000000000001', '🙂', 'a/four', 'four.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000105', '00000000-0000-7000-8000-000000000002', 'admin', 'b/one', 'one.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000106', '00000000-0000-7000-8000-000000000002', repeat('b', 150), 'b/two', 'two.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000107', '00000000-0000-7000-8000-000000000002', repeat('b', 150), 'b/three', 'three.ts', 'private', 1),
              ('00000000-0000-7000-8000-000000000108', '00000000-0000-7000-8000-000000000002', repeat('d', 99) || ' e', 'b/four', 'four.ts', 'private', 1);
            "#,
        )
        .unwrap();
    connection
        .batch_execute(include_str!("../migrations/202609221500_slugs/up.sql"))
        .unwrap();

    let expected_organizations = vec![
        "admin-2".to_owned(),
        "admin-3".to_owned(),
        "00000000-0000-0000-0000-000000000001-2".to_owned(),
        "00000000000000000000000000000001-2".to_owned(),
        "organization".to_owned(),
        "a".repeat(39),
        format!("{}-2", "a".repeat(37)),
        "foo-bar".to_owned(),
        "c".repeat(38),
    ];
    let expected_projects = vec![
        "admin".to_owned(),
        "admin-2".to_owned(),
        "00000000-0000-0000-0000-000000000001-2".to_owned(),
        "project".to_owned(),
        "admin".to_owned(),
        "b".repeat(100),
        format!("{}-2", "b".repeat(98)),
        "d".repeat(99),
    ];
    assert_eq!(slugs(connection, "organizations"), expected_organizations);
    assert_eq!(slugs(connection, "projects"), expected_projects);
    for (table, expected) in [("organization_slugs", 9), ("project_slugs", 8)] {
        assert_eq!(
            count(
                connection,
                &format!("SELECT count(*) AS count FROM {table}")
            ),
            expected
        );
    }
    assert_claims_match_current_subjects(connection);
    assert_eq!(
        count(
            connection,
            "SELECT count(*) AS count FROM project_slugs WHERE slug = 'admin'",
        ),
        2,
        "project slug uniqueness must be organization-scoped"
    );
    assert!(
        connection
            .batch_execute(
                "INSERT INTO organization_slugs (slug, organization_id) VALUES \
                 ('admin-2', '00000000-0000-7000-8000-000000000002')"
            )
            .is_err(),
        "organization claim uniqueness must be global"
    );
    assert!(
        connection
            .batch_execute(
                "INSERT INTO project_slugs (organization_id, slug, project_id) VALUES \
                 ('00000000-0000-7000-8000-000000000001', 'admin', \
                  '00000000-0000-7000-8000-000000000102')"
            )
            .is_err(),
        "project claim uniqueness must hold within an organization"
    );

    connection
        .batch_execute(include_str!("../migrations/202609221500_slugs/down.sql"))
        .unwrap();
    assert_eq!(
        count(connection, "SELECT count(*) AS count FROM organizations"),
        9
    );
    assert_eq!(
        count(connection, "SELECT count(*) AS count FROM projects"),
        8
    );
    assert_eq!(
        count(
            connection,
            r#"SELECT count(*) AS count FROM information_schema.columns
               WHERE table_schema = current_schema()
                 AND table_name IN ('organizations', 'projects')
                 AND column_name = 'slug'"#,
        ),
        0
    );

    connection
        .batch_execute(include_str!("../migrations/202609221500_slugs/up.sql"))
        .unwrap();
    assert_eq!(slugs(connection, "organizations"), expected_organizations);
    assert_eq!(slugs(connection, "projects"), expected_projects);
    assert_claims_match_current_subjects(connection);
}
