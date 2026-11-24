//! The walk records the receipt of returned edges rather than a losing read's digest.

use std::sync::{Arc, Mutex};

use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::closure::{ClosureBuilder, Walker};
use crate::head_validation::{ValidationRead, ValidationRecorderMock};
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::reference_index::{ReferenceEdges, ReferenceIndexMock};
use crate::viewer_fonts::ViewerFonts;

#[test]
fn walk_keeps_the_returned_edge_receipt_when_its_own_read_loses_a_parse_race() {
    let received = Arc::new(Mutex::new(Vec::new()));
    let saved = received.clone();
    let recorder = Unimock::new((
        ValidationRecorderMock::input
            .each_call(matching!(_, _))
            .returns(()),
        ValidationRecorderMock::observe
            .some_call(matching!("theme.css"))
            .returns(()),
        ValidationRecorderMock::content
            .some_call(matching!(
                ValidationRead::PublicTarget,
                "static/theme.css",
                _
            ))
            .returns(()),
        ValidationRecorderMock::content
            .some_call(matching!(
                ValidationRead::StaticContent,
                "static/theme.css",
                _
            ))
            .answers_arc(Arc::new(move |_, _, _, identity| {
                saved.lock().unwrap().push(identity)
            })),
    ));
    let walker = Walker {
        observer: None,
        tree: Arc::new(Unimock::new(
            SourceTreeMock::read_public
                .some_call(matching!(_))
                .returns(Ok(b"p{color:red}".to_vec())),
        )),
        policy: Arc::new(Unimock::new(
            PublicPolicyMock::check
                .some_call(matching!("theme.css"))
                .returns(Ok(PublicFile {
                    path: "theme.css".into(),
                    absolute: "/repo/theme.css".into(),
                })),
        )),
        generated: Arc::new(Unimock::new(())),
        index: Arc::new(Unimock::new((
            ReferenceIndexMock::get_identified
                .some_call(matching!("static/theme.css"))
                .returns(None),
            ReferenceIndexMock::parse_identified
                .some_call(matching!((path, bytes, _) if *path == "static/theme.css" && *bytes == b"p{color:red}"))
                .returns(Ok(ReferenceEdges {
                    urls: vec![],
                    identity: Some([7; 32]),
                })),
        ))),
    };
    let closure = walker
        .collect_recorded(
            "home/index.html",
            &[],
            &["theme.css".into()],
            ViewerFonts::Denied,
            &recorder,
        )
        .unwrap();
    assert_eq!(*received.lock().unwrap(), [Some([7; 32])]);
    assert_eq!(closure.files.into_iter().collect::<Vec<_>>(), ["theme.css"]);
}
