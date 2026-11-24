//! The bounded attempt store decides whether a used context can end before graph drop.

use std::sync::{Arc, Mutex, mpsc};

use mokly_css::types::StylesheetBundler;
use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use crate::leases::ContextLease;
use crate::stylesheet_store::StylesheetCache;
use crate::stylesheets::StylesheetAttempt;

use super::stylesheet_support::{attempt, bundler, charges, roots, tree};

#[test]
fn record_loss_keeps_the_used_context_until_the_attempt_is_dropped() {
    for kind in ["kept", "evicted", "oversize"] {
        let tree = tree(&Arc::default(), &[]);
        let (bytes, context) = charges(&tree);
        let limit = match kind {
            "kept" => 64 * 1024 * 1024,
            "evicted" => bytes + context + 4096,
            _ => 0,
        };
        let shared = Arc::new(Mutex::new(StylesheetCache::new(limit)));
        let calls = Arc::new(Mutex::new(Vec::new()));
        let recorded = calls.clone();
        let (released, _) = mpsc::channel();
        {
            let compiler = attempt(bundler(Arc::default()), tree, &shared);
            for root in roots(2) {
                compiler.bundle(&root).unwrap();
            }
            let context = Arc::new(ContextLease::new(
                "context".into(),
                "settings".into(),
                Arc::new(Unimock::new(
                    PoolMock::release_context
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, context| {
                            recorded.lock().unwrap().push(context.to_owned());
                        }))
                        .at_least_times(0),
                )),
                released,
            ));
            context.begin_use();
            let attempt = StylesheetAttempt {
                compiler: Arc::new(compiler),
                context: Some(context),
            };
            attempt.retire_used();
            let expected = if kind == "kept" {
                vec!["context"]
            } else {
                vec![]
            };
            let observed = calls.lock().unwrap().clone();
            assert_eq!(observed, expected, "{kind}");
        }
        let observed = calls.lock().unwrap().clone();
        assert_eq!(observed, ["context"], "{kind}");
    }
}
