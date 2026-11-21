//! Only a live used head of the same explicit configuration blocks preparation.

use std::sync::{Arc, mpsc};

use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use crate::leases::ContextLease;
use crate::runtime::Runtime;

fn runtime(used: bool) -> Runtime {
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(if used {
            Unimock::new(
                PoolMock::release_context
                    .each_call(matching!(_))
                    .returns(()),
            )
        } else {
            Unimock::new(())
        }),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    )
    .with_stylesheet_watching()
}

fn context(runtime: &Runtime, id: &str, configuration: &str) -> Arc<ContextLease> {
    Arc::new(ContextLease::new(
        id.into(),
        configuration.into(),
        runtime.pool.clone(),
        mpsc::channel().0,
    ))
}

#[test]
fn older_context_guard_uses_configuration_activity_and_head_ownership() {
    for kind in [
        "live", "foreign", "unused", "retired", "dropped", "base", "build", "current",
    ] {
        let runtime = runtime(kind != "unused");
        let current = context(&runtime, "current", "selected");
        let mut older = Some(if kind == "current" {
            current.clone()
        } else {
            context(
                &runtime,
                "older",
                if kind == "foreign" {
                    "other"
                } else {
                    "selected"
                },
            )
        });
        let lease = older.as_ref().unwrap();
        if kind != "unused" {
            lease.begin_use();
        }
        let owner = match kind {
            "base" => runtime.for_base(runtime.tree.clone(), "test".into(), None),
            "build" => {
                let mut build = runtime.clone();
                build.watch_stylesheets = false;
                build
            }
            _ => runtime.clone(),
        };
        owner.track_head_context(lease);
        if kind == "retired" {
            lease.retire();
        }
        if kind == "dropped" {
            older = None;
        }
        assert_eq!(
            runtime.older_used_head_context(&current),
            kind == "live",
            "{kind}"
        );
        assert_eq!(older.is_some(), kind != "dropped");
    }
}
