//! Key changes and freshness outcomes govern the single production slot.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::{ResolvedRoot, RootConfig};
use mokly_compare::base_freshness::{Freshness, FreshnessMock};
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::Error;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_server::changes::ChangeCancellation;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base::ServeBase;
use crate::serve_preparation_control::PreparationControlMock;
use crate::warning_support::{catalogue, config};

use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn equal_keys_reuse_and_each_adopted_key_change_releases_the_old_base() {
    for change in [
        "equal",
        "commit",
        "input",
        "file",
        "repository",
        "root",
        "authored",
        "scripts",
    ] {
        let waits = Arc::new(AtomicUsize::new(0));
        let scans = Arc::new(AtomicUsize::new(0));
        let gate_waits = waits.clone();
        let freshness_waits = waits.clone();
        let freshness_scans = scans.clone();
        let gates = Unimock::new((
            PreparationControlMock::wait
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    gate_waits.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                })),
            FreshnessMock::current
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _, _| {
                    freshness_scans.fetch_add(1, Ordering::SeqCst);
                    Ok(freshness_waits.load(Ordering::SeqCst) == 1)
                })),
        ))
        .no_verify_in_drop();
        let freshness: Arc<dyn Freshness> = Arc::new(gates.clone());
        let mut fixture = Fixture::new(
            Arc::default(),
            freshness,
            Arc::new(Unimock::new(())),
            runtime(),
        );
        Arc::get_mut(&mut fixture.provider).unwrap().preparation = Some(Arc::new(gates));
        let mut config = config();
        let mut pinned = selected("a");
        let head = head(false);
        let old = {
            let base = base(Some(inputs(false)));
            let weak = Arc::downgrade(&base);
            fixture
                .provider
                .keep(
                    &BaseRetentionRequest {
                        selected: &pinned,
                        working_config: &config,
                        head: head.as_ref(),
                        install_scripts: false,
                    },
                    base,
                )
                .unwrap();
            weak
        };
        match change {
            "commit" => pinned.commit = selected("b").commit,
            "input" => config.input.renderer = Some("provider.tsx".into()),
            "file" => config.file = "/repo/other.json".into(),
            "repository" => config.repo_root = "/other".into(),
            "root" => config.roots.push(ResolvedRoot {
                input: RootConfig {
                    dir: "specs".into(),
                    files: None,
                    path: None,
                    transparent: None,
                },
                directory: "/repo/specs".into(),
                identity: "/physical/specs".into(),
            }),
            "authored" => config.authored_inputs.push("/repo/provider.tsx".into()),
            _ => {}
        }
        let found = fixture
            .provider
            .find_kept(&BaseRetentionRequest {
                selected: &pinned,
                working_config: &config,
                head: head.as_ref(),
                install_scripts: change == "scripts",
            })
            .unwrap();
        assert_eq!(found.is_some(), change == "equal", "{change}");
        assert_eq!(
            waits.load(Ordering::SeqCst),
            usize::from(change == "equal"),
            "{change}"
        );
        assert_eq!(
            scans.load(Ordering::SeqCst),
            usize::from(change == "equal"),
            "{change}"
        );
        assert_eq!(old.upgrade().is_some(), change == "equal", "{change}");
    }
}

#[derive(Clone, Copy, Debug)]
enum Outcome {
    Current,
    Stale,
    Failure,
    Cancelled,
    Replaced,
}

#[test]
fn freshness_misses_and_errors_release_but_classification_cancellation_preserves_the_slot() {
    for outcome in [
        Outcome::Current,
        Outcome::Stale,
        Outcome::Failure,
        Outcome::Cancelled,
        Outcome::Replaced,
    ] {
        let fixture = Fixture::new(
            Arc::default(),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            runtime(),
        );
        let freshness = Arc::new(Unimock::new(
            FreshnessMock::current.some_call(matching!(_)).answers_arc({
                let origin = fixture.origin.clone();
                let slot = fixture.slot.clone();
                Arc::new(move |_, _, _| {
                    assert!(
                        slot.try_lock().is_ok(),
                        "freshness must run outside the slot lock"
                    );
                    match outcome {
                        Outcome::Current => Ok(true),
                        Outcome::Stale => Ok(false),
                        Outcome::Failure => Err(Error::UnsupportedManager),
                        Outcome::Cancelled => Err(Error::Cancelled),
                        Outcome::Replaced => {
                            origin.cancel();
                            Ok(false)
                        }
                    }
                })
            }),
        ));
        let provider = ServeBase {
            preparation: None,
            freshness,
            slot: fixture.provider.slot.clone(),
            inner: fixture.provider.inner.clone(),
            runtime: fixture.provider.runtime.clone(),
            reader: fixture.provider.reader.clone(),
            origin: fixture.provider.origin.clone(),
            lifetime: fixture.provider.lifetime.clone(),
        };
        let config = config();
        let selected = selected("a");
        let head = head(false);
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: &config,
            head: head.as_ref(),
            install_scripts: false,
        };
        let old = {
            let base = base(Some(inputs(false)));
            let weak = Arc::downgrade(&base);
            provider.keep(&request, base).unwrap();
            weak
        };
        let found = provider.find_kept(&request);
        assert!(
            matches!(
                (&outcome, &found),
                (Outcome::Current, Ok(Some(_)))
                    | (Outcome::Stale | Outcome::Failure, Ok(None))
                    | (
                        Outcome::Cancelled | Outcome::Replaced,
                        Err(Error::Cancelled)
                    )
            ),
            "{outcome:?}"
        );
        assert_eq!(
            old.upgrade().is_some(),
            matches!(
                outcome,
                Outcome::Current | Outcome::Cancelled | Outcome::Replaced
            ),
            "{outcome:?}"
        );
    }
}

#[test]
fn html_and_sidecar_freshness_use_their_original_directory_sources() {
    for html in [false, true] {
        let runtime = runtime();
        runtime.dependency_usage.record(
            &[("node_modules".into(), "node_modules".into())].into(),
            "node_modules/x.js",
        );
        let freshness = Arc::new(Unimock::new(
            FreshnessMock::current
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _, request| {
                    let expected = if html {
                        "packages/html/node_modules"
                    } else {
                        "node_modules"
                    };
                    Ok(request.directories == [expected] && request.unmapped.is_empty())
                })),
        ));
        let fixture = Fixture::new(
            Arc::default(),
            freshness,
            Arc::new(Unimock::new(())),
            runtime,
        );
        let mut catalogue = catalogue(Vec::new());
        catalogue
            .dependency_directories
            .insert("packages/html/node_modules".into());
        let head: Arc<dyn RenderGeneration> = if html {
            Arc::new(Unimock::new(
                RenderGenerationMock::catalogue
                    .some_call(matching!())
                    .returns(catalogue),
            ))
        } else {
            head(false)
        };
        let config = config();
        let selected = selected("a");
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: &config,
            head: head.as_ref(),
            install_scripts: false,
        };
        fixture
            .provider
            .keep(&request, base(Some(inputs(html))))
            .unwrap();
        assert!(
            fixture.provider.find_kept(&request).unwrap().is_some(),
            "html={html}"
        );
    }
}
