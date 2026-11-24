//! A matching base key cannot adopt stale dependency or working input evidence.

use std::sync::{Arc, Mutex};

use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::inputs::Inputs;
use mokly_compare::working_inputs::WorkingInputsMock;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base_key::BaseKey;
use crate::serve_eager_evidence::{AdoptionEvidence, HeadEvidence, NativeEvidence};
use crate::warning_support::{catalogue, config};

#[test]
fn eager_adoption_rejects_same_key_stale_working_or_head_dependency_inputs() {
    let config = config();
    let selected = PinnedBase {
        reference: "main".into(),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        repository: Arc::new(
            Unimock::new(
                RepositoryMock::checkout_identity
                    .each_call(matching!(_))
                    .answers(&|_, _| {
                        Ok(CheckoutIdentity {
                            digest: "checkout".into(),
                            filtered: false,
                        })
                    }),
            )
            .no_verify_in_drop(),
        ),
    };
    let head = Unimock::new(
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue(Vec::new())),
    )
    .no_verify_in_drop();
    let request = BaseRetentionRequest {
        selected: &selected,
        working_config: &config,
        head: &head,
        install_scripts: false,
    };
    let mut changed = Inputs::default();
    changed.files.insert(
        RepoPath::parse("package.json").unwrap(),
        b"changed".to_vec(),
    );
    let mut observed = Vec::new();
    for (working_changed, directories) in [
        (true, Vec::new()),
        (false, vec!["node_modules".into()]),
        (false, Vec::new()),
    ] {
        let current = if working_changed {
            changed.clone()
        } else {
            Inputs::default()
        };
        let evidence: &dyn AdoptionEvidence = &NativeEvidence {
            key: BaseKey::new(&request).unwrap(),
            working: Arc::new(
                Unimock::new(
                    WorkingInputsMock::read
                        .some_call(matching!(_, _, _))
                        .returns(Ok(current)),
                )
                .no_verify_in_drop(),
            ),
            inputs: Some(Inputs::default()),
            checkout: Some(CheckoutIdentity {
                digest: "checkout".into(),
                filtered: false,
            }),
            head: Mutex::new(Some(HeadEvidence {
                directories: Vec::new(),
                unmapped: Vec::new(),
                catalogue: Vec::new(),
            })),
        };
        observed.push(evidence.current(&request, &directories, &[]).unwrap());
    }
    assert_eq!(observed, [false, false, true]);
}
