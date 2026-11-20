//! History union ordering, cursor continuation, filters and membership.

use chrono::Duration;
use diesel::prelude::*;
use mkc_store_interface::build_history::HistoryEntry;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::store::Callback;
use mkc_store_interface::viewer::HistoryFilter;
use uuid::Uuid;

use super::support::{attempt, finish, fixture};

#[test]
fn history_orders_both_kinds_with_a_complete_time_and_uuid_cursor() {
    let Some(f) = fixture() else {
        return;
    };
    let mut first = f.build("topic", 1);
    first.id = Uuid::from_u128(100).into();
    first.pull_request = Some(7);
    let mut second = f.build("topic", 2);
    second.id = Uuid::from_u128(300).into();
    second.branch = "other".into();
    f.schedule(&first);
    f.schedule(&second);
    let mut p = f.publication(&first);
    p.build_id = None;
    p.id = Uuid::from_u128(200).into();
    let mut older = f.publication(&second);
    older.build_id = None;
    older.id = Uuid::from_u128(400).into();
    older.created_at -= Duration::seconds(1);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&p)?;
            q.insert_publication(&older)
        }))
        .unwrap();
    f.store.read(&mut Callback(&mut |q| {
        let mut keys = Vec::new(); let mut cursor = None;
        loop {
            let page = q.build_history(f.project.id, &HistoryFilter::default(), cursor.as_ref(), 1, true)?;
            if page.is_empty() { break; }
            cursor = Some(page[0].key()); keys.push(cursor.clone().unwrap());
        }
        assert_eq!(keys.iter().map(|k| k.id.as_u128()).collect::<Vec<_>>(), [300, 200, 100, 400]);
        assert!(keys.windows(2).all(|pair| (pair[0].created_at, pair[0].id) > (pair[1].created_at, pair[1].id)));
        let filter = HistoryFilter { branch: Some("topic".into()), pull_request: Some(7) };
        let page = q.build_history(f.project.id, &filter, None, 100, true)?;
        assert_eq!(page.len(), 2); assert!(matches!(page[0], HistoryEntry::Publication(_)));
        assert!(matches!(page[1], HistoryEntry::Build(_)));
        assert_eq!(q.build_history(f.project.id, &filter, None, 100, false)?.len(), 1);
        assert!(q.build_history(Uuid::now_v7().into(), &HistoryFilter::default(), None, 100, true)?.is_empty());
        Ok(())
    })).unwrap();
}

#[test]
fn history_keeps_unpublished_failures_and_hides_build_upload_attempts_for_every_reader() {
    let Some(f) = fixture() else {
        return;
    };
    let failed = f.build("failed", 1);
    f.schedule(&failed);
    let cancelled = f.build("cancelled", 2);
    f.schedule(&cancelled);
    let replaced = f.build("replaced", 3);
    f.schedule(&replaced);
    let newer = f.build("replaced", 4);
    f.schedule(&newer);
    let committed = f.build("committed", 5);
    f.schedule(&committed);
    let mut rejected = f.publication(&failed);
    rejected.state = PublicationState::Failed;
    rejected.failure = Some(PublicationFailure::InvalidBundle);
    rejected.changes = None;
    let mut unfinished = f.publication(&failed);
    unfinished.metadata = None;
    unfinished.state = PublicationState::Uploading;
    unfinished.changes = None;
    let ready = f.publication(&committed);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            let mut fail = finish(f.now, BuildState::Failed);
            fail.failure_cause = Some(BuildFailure::PlanRequired);
            assert!(q.finish_build(failed.id, None, &fail)?);
            q.cancel_build(f.project.id, cancelled.id, f.now)?;
            q.start_build(committed.id, &a)?.unwrap();
            q.insert_publication(&rejected)?;
            q.insert_publication(&unfinished)?;
            q.insert_publication(&ready)?;
            Ok(())
        }))
        .unwrap();
    let mut connection = f.connection();
    diesel::sql_query("UPDATE builds SET publication_id = $2 WHERE id = $1")
        .bind::<diesel::sql_types::Uuid, _>(committed.id.0)
        .bind::<diesel::sql_types::Uuid, _>(ready.id.0)
        .execute(&mut connection)
        .unwrap();
    f.store
        .read(&mut Callback(&mut |q| {
            let page = q.build_history(f.project.id, &HistoryFilter::default(), None, 100, true)?;
            let ids: Vec<_> = page.iter().map(|e| e.key().id).collect();
            assert_eq!(page.len(), 3);
            assert!(ids.contains(&failed.id.0));
            assert!(ids.contains(&newer.id.0));
            assert!(ids.contains(&ready.id.0));
            for id in [
                rejected.id.0,
                unfinished.id.0,
                committed.id.0,
                cancelled.id.0,
                replaced.id.0,
            ] {
                assert!(!ids.contains(&id));
            }
            let public =
                q.build_history(f.project.id, &HistoryFilter::default(), None, 100, false)?;
            assert_eq!(public.len(), 1);
            assert_eq!(public[0].key().id, ready.id.0);
            Ok(())
        }))
        .unwrap();
}
