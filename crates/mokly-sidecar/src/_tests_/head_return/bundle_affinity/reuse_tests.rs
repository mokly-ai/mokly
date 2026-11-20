//! The pool's classified cache result excludes known recipe reuse from rank.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, ReadOutcome, RecordToken, WriteOutcome};
use crate::compiled_fixture::compiled;
use crate::durable_recipe::DurableRecipe;
use crate::methods::Call;
use crate::pool::SidecarPool;
use crate::reusable_recipe::ReusableRecipe;
use crate::wire::MethodResult;

use super::super::support::{Event, bundle};
use super::support::{hold, hold_newest, release, requests, three};

#[test]
fn memory_recipe_reuse_neither_creates_nor_raises_a_compilation_rank() {
    for existing_record in [false, true] {
        let harness = three();
        let pool = &harness.pool;
        let newest = hold_newest(pool);
        let uncompiled = hold(pool, "/head");
        let remaining = if existing_record {
            uncompiled
        } else {
            let older = hold(pool, "/head");
            release(pool, uncompiled);
            older
        };
        let MethodResult::Bundle(result) = pool.request(bundle("/head", "older")).unwrap() else {
            panic!("expected bundle");
        };
        release(pool, remaining);
        release(pool, newest);
        pool.request(bundle("/head", "probe")).unwrap();
        let selected = requests(&harness, "probe");
        pool.abort().unwrap();
        assert_eq!(result.cache, Some(CacheOutcome::Memory));
        assert_eq!(
            selected,
            [Event::Request(1, "probe".into())],
            "{existing_record}"
        );
    }
}

#[test]
fn a_disk_recipe_hit_does_not_create_a_compilation_rank() {
    let mut harness = three();
    let Call::Bundle(request) = bundle("/head", "disk") else {
        panic!("expected bundle");
    };
    let recipe = DurableRecipe::new(
        ReusableRecipe::new(
            "disk".into(),
            request.params,
            vec![],
            Arc::new(compiled("disk")),
        )
        .unwrap(),
    )
    .unwrap();
    let store = Unimock::new((
        BundleStoreMock::load
            .some_call(matching!(_))
            .returns(ReadOutcome::Hit {
                recipe: Box::new(recipe),
                token: RecordToken::new([7; 32]),
                maintenance: WriteOutcome::Unchanged,
            }),
        BundleStoreMock::save
            .some_call(matching!(_))
            .returns(WriteOutcome::Unchanged),
    ));
    Arc::get_mut(&mut harness.pool).unwrap().bundle_store = Some(Arc::new(store));
    let newest = hold_newest(&harness.pool);
    let uncompiled = hold(&harness.pool, "/head");
    let older = hold(&harness.pool, "/head");
    release(&harness.pool, uncompiled);
    let MethodResult::Bundle(result) = harness.pool.request(bundle("/head", "disk")).unwrap()
    else {
        panic!("expected bundle");
    };
    Arc::get_mut(&mut harness.pool).unwrap().bundle_store = None;
    release(&harness.pool, older);
    release(&harness.pool, newest);
    harness.pool.request(bundle("/head", "probe")).unwrap();
    let selected = requests(&harness, "probe");
    harness.pool.abort().unwrap();
    assert_eq!(result.cache, Some(CacheOutcome::Hit));
    assert_eq!(selected, [Event::Request(1, "probe".into())]);
}
