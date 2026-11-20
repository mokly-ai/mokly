//! Expired owners cannot restore a lease after another replica fills capacity.

use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Timestamptz};
use mkc_store_interface::store::Callback;

use super::support::{attempt, fixture, rc};

#[derive(QueryableByName)]
struct Live {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

fn live(connection: &mut PgConnection, at: DateTime<Utc>) -> i64 {
    let count = diesel::sql_query(
        "SELECT count(*) FROM builds WHERE state = 'running' AND lease_expires_at > $1",
    )
    .bind::<Timestamptz, _>(at)
    .get_result::<Live>(connection)
    .unwrap()
    .count;
    assert!(count <= 2, "organization has {count} live leases");
    count
}

#[test]
fn an_expired_locked_owner_cannot_renew_after_a_replica_starts_the_third_build() {
    let Some(f) = fixture() else { return };
    let builds: Vec<_> = (0..3).map(|i| f.build(&format!("branch-{i}"), i)).collect();
    for build in &builds {
        f.schedule(build);
    }
    let a = attempt(f.now);
    let mut b = attempt(f.now);
    b.lease_expires_at += Duration::minutes(2);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(builds[0].id, &a)?.unwrap();
            q.start_build(builds[1].id, &b)?.unwrap();
            Ok(())
        }))
        .unwrap();
    let mut holder = f.connection();
    let mut replica = f.connection();
    let mut observer = f.connection();
    assert_eq!(live(&mut observer, f.now), 2);
    let at = a.lease_expires_at + Duration::microseconds(1);
    holder
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            diesel::sql_query("SELECT id FROM builds WHERE id = $1 FOR UPDATE")
                .bind::<diesel::sql_types::Uuid, _>(builds[0].id.0)
                .execute(connection)?;
            assert_eq!(live(&mut observer, at), 1);
            rc(&mut replica, |q| {
                assert_eq!(q.claim_build(&|| at).unwrap().unwrap().id, builds[2].id);
                assert!(q.start_build(builds[2].id, &attempt(at)).unwrap().is_some());
            });
            assert_eq!(live(&mut observer, at), 2);
            Ok(())
        })
        .unwrap();
    rc(&mut replica, |q| {
        assert!(
            !q.renew_build(
                builds[0].id,
                a.lease_token,
                &|| at,
                (at + Duration::minutes(2)) - (at)
            )
            .unwrap()
        );
    });
    assert_eq!(live(&mut observer, at), 2);
}

#[test]
fn renewal_requires_a_lease_strictly_later_than_the_renewal_time() {
    for delta in [-1, 0, 1] {
        let Some(f) = fixture() else { return };
        let build = f.build("main", 1);
        f.schedule(&build);
        let a = attempt(f.now);
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(build.id, &a)?.unwrap();
                Ok(())
            }))
            .unwrap();
        let at = a.lease_expires_at + Duration::microseconds(delta);
        rc(&mut f.connection(), |q| {
            assert_eq!(
                q.renew_build(
                    build.id,
                    a.lease_token,
                    &|| at,
                    (at + Duration::minutes(2)) - (at)
                )
                .unwrap(),
                delta < 0
            );
            let stored = q.build(f.project.id, build.id).unwrap().unwrap();
            assert_eq!(stored.attempt, 1);
            assert_eq!(
                stored.lease_expires_at,
                Some(if delta < 0 {
                    at + Duration::minutes(2)
                } else {
                    a.lease_expires_at
                })
            );
        });
    }
}
