//! Every successful walk records its complete proof, including ignored unavailable inputs.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use mokly_html::tree;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::closure::{ClosureBuilder, ClosureObserverMock, GeneratedResourcesMock, Walker};
use crate::head_validation::{ValidationRead, ValidationRecorderMock};
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::reference_index::MemoryReferenceIndex;

#[test]
fn walk_records_every_input_class_and_ignored_unavailable_targets() {
    let inputs = Arc::new(Mutex::new(BTreeSet::new()));
    let observed = Arc::new(Mutex::new(Vec::new()));
    let saved = inputs.clone();
    let paths = observed.clone();
    let receipts = inputs.clone();
    let recorder = Unimock::new((
        ValidationRecorderMock::input
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, kind, route| {
                saved.lock().unwrap().insert((kind, route.to_owned()));
            }))
            .at_least_times(0),
        ValidationRecorderMock::content
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, kind, route, _| {
                receipts.lock().unwrap().insert((kind, route.to_owned()));
            }))
            .at_least_times(0),
        ValidationRecorderMock::observe
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                paths.lock().unwrap().push(path.to_owned())
            }))
            .at_least_times(0),
    ));
    let walker = Walker {
        observer: None,
        tree: Arc::new(Unimock::new(
            SourceTreeMock::digest
                .some_call(matching!(_))
                .answers(&|_, path| {
                    Err(SourceError::Unavailable {
                        path: path.into(),
                        message: "conversion unavailable".into(),
                    })
                }),
        )),
        policy: Arc::new(Unimock::new(
            PublicPolicyMock::check
                .some_call(matching!("ignored.png"))
                .returns(Ok(PublicFile {
                    path: "ignored.png".into(),
                    absolute: "/repo/ignored.png".into(),
                })),
        )),
        generated: Arc::new(Unimock::new((
            GeneratedResourcesMock::is_document
                .some_call(matching!("theme.css"))
                .returns(false),
            GeneratedResourcesMock::resource
                .some_call(matching!("theme.css"))
                .returns(Ok(Some(b"p{color:red}".to_vec()))),
        ))),
        index: Arc::new(MemoryReferenceIndex::default()),
    };
    let nodes = vec![
        Node::Region {
            region: Region {
                id: "ignore".into(),
                kind: RegionKind::Ignore {
                    id: "clock".into(),
                    material_key: None,
                },
            },
            children: vec![tree::element(
                "img",
                &[("src", "../../ignored.png")],
                vec![],
            )],
        },
        tree::element(
            "link",
            &[("rel", "stylesheet"), ("href", "../theme.css")],
            vec![],
        ),
    ];
    let closure = walker
        .collect_recorded("home/index.html", &nodes, &[], &recorder)
        .unwrap();
    assert_eq!(
        *inputs.lock().unwrap(),
        BTreeSet::from([
            (ValidationRead::Policy, String::new()),
            (ValidationRead::Document, "home/index.html".into()),
            (ValidationRead::PublicTarget, "static/ignored.png".into()),
            (ValidationRead::StaticContent, "static/ignored.png".into()),
            (
                ValidationRead::GeneratedMembership,
                "static/mokly-generated/theme.css".into()
            ),
            (
                ValidationRead::GeneratedContent,
                "static/mokly-generated/theme.css".into()
            ),
        ])
    );
    assert_eq!(*observed.lock().unwrap(), ["ignored.png"]);
    assert_eq!(closure.files, BTreeSet::new());
    assert_eq!(closure.warnings.len(), 1);
    assert_eq!(closure.warnings[0].message, "conversion unavailable");
}

#[test]
fn lexical_observer_runs_before_proof_or_validation_reads_a_static_target() {
    let boundary = Unimock::new((
        ValidationRecorderMock::input
            .next_call(matching!(ValidationRead::Policy, ""))
            .returns(()),
        ValidationRecorderMock::input
            .next_call(matching!(ValidationRead::Document, "home/index.html"))
            .returns(()),
        ClosureObserverMock::observe
            .next_call(matching!("home/index.html", "icon.png"))
            .returns(Ok(())),
        ValidationRecorderMock::observe
            .some_call(matching!("icon.png"))
            .returns(()),
        PublicPolicyMock::check
            .next_call(matching!("icon.png"))
            .returns(Ok(PublicFile {
                path: "icon.png".into(),
                absolute: "/repo/icon.png".into(),
            })),
        ValidationRecorderMock::content
            .next_call(matching!(
                ValidationRead::PublicTarget,
                "static/icon.png",
                _
            ))
            .returns(()),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("digest".into())),
        ValidationRecorderMock::content
            .next_call(matching!(
                ValidationRead::StaticContent,
                "static/icon.png",
                _
            ))
            .returns(()),
    ));
    let walker = Walker {
        observer: Some(Arc::new(boundary.clone())),
        tree: Arc::new(boundary.clone()),
        policy: Arc::new(boundary.clone()),
        generated: Arc::new(Unimock::new(())),
        index: Arc::new(MemoryReferenceIndex::default()),
    };
    let closure = walker
        .collect_recorded("home/index.html", &[], &["icon.png".into()], &boundary)
        .unwrap();
    assert_eq!(closure.files, BTreeSet::from(["icon.png".into()]));
}
