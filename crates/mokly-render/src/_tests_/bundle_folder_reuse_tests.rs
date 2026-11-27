//! Retained marked generations reread their cache-only folder files.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedModules};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_model::material::digest;
use mokly_sidecar::compiled::{PhysicalInput, ReuseEvidence, UncapturedEvidence};
use mokly_sidecar::methods::BundleCapture;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::bundle::BundleState;
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::physical_inputs::PhysicalInputsMock;
use crate::runtime::Runtime;
use crate::{bundle_inputs, render_environment};

use super::bundle_reuse_tests::{definitions, pool};

#[test]
fn folder_file_changes_reject_a_retained_marked_generation() {
    for current in [true, false] {
        let reader = Unimock::new(
            PhysicalInputsMock::matches
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| Ok(current))),
        );
        let mut runtime = Runtime::new(
            Arc::new(Unimock::new(
                SourceTreeMock::digest
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok("source".into())),
            )),
            Arc::new(Unimock::new(
                SourceTreeMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(None)),
            )),
            Arc::new(reader),
            Arc::new(pool(
                BundleCapture::ServeEdit,
                if current { "retained" } else { "fresh" },
            )),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            "test".into(),
            None,
        );
        runtime.bundle_capture = BundleCapture::ServeEdit;
        let config = ResolvedConfig {
            input: Config {
                renderer: Some("renderer.tsx".into()),
                ..Config::default()
            },
            file: "/repo/mokly.config.json".into(),
            repo_root: "/repo".into(),
            modules: ResolvedModules {
                renderer: Some("renderer.tsx".into()),
                ..ResolvedModules::default()
            },
            authored_inputs: vec![],
            roots: vec![],
        };
        let side = runtime.side(&config);
        let params = bundle_inputs::params(&config, &[], &side);
        let settings =
            bundle_inputs::cache_key(&config, &params, &side, runtime.dependency_tree.as_ref())
                .unwrap();
        let retained = Arc::new(BundleState {
            package_imports: Default::default(),
            persistence_identity: None,
            repository: "/repo".into(),
            settings,
            lease: Arc::new(BundleLease {
                id: "retained".into(),
                epoch: 1,
                pool: runtime.pool.clone(),
            }),
            class_maps_digest: digest(b"{}"),
            definitions: definitions(),
            modules: BTreeMap::from([("entry.ts".into(), vec![])]),
            module_digests: BTreeMap::new(),
            render: render_environment::RenderEnvironment::default(),
            stamp: InputStamp {
                files: BTreeMap::from([("/repo/entry.ts".into(), Some("source".into()))]),
                ..InputStamp::default()
            },
            toolchain: "fixture".into(),
            reuse_evidence: Arc::new(ReuseEvidence {
                complete: false,
                durable: false,
                uncaptured: Some(UncapturedEvidence::ServeEdit),
                inputs: BTreeMap::from([("/outside/missing.ts".into(), PhysicalInput::Absent)]),
            }),
        });
        runtime
            .bundles
            .lock()
            .unwrap()
            .insert("retained".into(), Arc::downgrade(&retained));
        let described = runtime.describe(&config, &[]).unwrap();
        assert_eq!(
            described.generation.unwrap().id,
            if current { "retained" } else { "fresh" }
        );
    }
}
