//! Shared documents still check the head and record both sides' document and closure proofs.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_git::control::CancellationMock;
use mokly_graph::comparison_proof::ComparisonRead;
use mokly_graph::types::{RenderGenerationMock, RenderSummary};
use mokly_html::parse;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::review_affected::ReviewSide;
use unimock::{MockFn, Unimock, matching};

use crate::base_reader::BaseReader;
use crate::base_retention::{BaseReuse, KeptBase};
use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::LosslessRestorer;
use crate::comparison_capture::CapturedView;
use crate::comparison_consumer::{Consumer, ViewConsumer};
use crate::comparison_preparation::{Preparation, ViewInput, ViewPreparation};
use crate::comparison_types::ViewKey;
use crate::comparison_views::PairViews;
use crate::reuse_budget::Resident;
use crate::reuse_memo::RecordingMemo;
use crate::reuse_probes::Probes;

use super::recording_resources::{closure, memo};
use super::support::{ROUTE, artifact};

#[derive(Debug, PartialEq)]
enum Event {
    HeadDocument,
    HeadClosure,
    Proof(ReviewSide, ComparisonRead, String),
}

#[test]
fn admitted_and_mismatched_kept_inputs_keep_checked_reads_closures_proof_sets_and_memo_order() {
    for equal in [true, false] {
        compare(equal);
    }
}

fn compare(equal: bool) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let before_events = events.clone();
    let mut document = artifact();
    let resources = "<link rel=\"stylesheet\" href=\"../../theme.css\"><iframe src=\"../../embedded.html\"></iframe>";
    document.bytes.extend_from_slice(resources.as_bytes());
    document
        .document
        .as_mut()
        .unwrap()
        .tree
        .extend(parse::html(DeliveredHtml::fragment(resources)));
    let before = CapturedGeneration {
        source: Arc::new(Unimock::new((
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
            RenderGenerationMock::comparison_identity
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, read, route, _| {
                    before_events.lock().unwrap().push(Event::Proof(
                        ReviewSide::Before,
                        read,
                        route.into(),
                    ));
                    Some([1; 32])
                })),
        ))),
        views: BTreeMap::from([(
            ROUTE.into(),
            CapturedView::encode(&document, closure("base.svg")).unwrap(),
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(LosslessRestorer),
    };
    let before = BaseReader::new(BaseReuse {
        base: Arc::new(KeptBase {
            generation: Arc::new(before),
            failures: Arc::new(Unimock::new(())),
            scripts_off: false,
            freshness: None,
        }),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        releaser: Arc::new(Unimock::new(())),
    });
    if !equal {
        document.bytes.push(b'\n');
    }
    let document = Arc::new(document);
    let head_document = events.clone();
    let head_closure = events.clone();
    let after_events = events.clone();
    let after = Unimock::new((
        RenderGenerationMock::comparison_document
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                head_document.lock().unwrap().push(Event::HeadDocument);
                Ok(document.clone())
            }))
            .once(),
        RenderGenerationMock::closure
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                head_closure.lock().unwrap().push(Event::HeadClosure);
                Ok(closure("head.svg"))
            }))
            .once(),
        RenderGenerationMock::comparison_identity
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, read, route, _| {
                after_events.lock().unwrap().push(Event::Proof(
                    ReviewSide::After,
                    read,
                    route.into(),
                ));
                Some([2; 32])
            })),
    ));
    let probes = Probes::new(&Resident::new(1024 * 1024));
    let paths = BTreeMap::from([("home".into(), "Home".into())]);
    let preparation = Preparation {
        before: &before,
        after: &after,
        paths: &paths,
        paths_preserved: true,
        probes: Some(&probes),
        recording: Some(&AtomicBool::new(true)),
    };
    let ViewInput::Ready(prepared) = preparation
        .retained(Some(ROUTE), Some(ROUTE), false)
        .unwrap()
    else {
        panic!("retained equal document")
    };
    assert_eq!(prepared.equal_document, equal);
    assert_eq!(
        prepared.resources.before.files,
        BTreeSet::from(["base.svg".into()])
    );
    assert_eq!(
        prepared.resources.after.files,
        BTreeSet::from(["head.svg".into()])
    );
    assert_eq!(prepared.recorder.as_ref().unwrap().len(), 4);
    assert_eq!(
        *events.lock().unwrap(),
        [
            Event::Proof(ReviewSide::Before, ComparisonRead::Document, ROUTE.into()),
            Event::Proof(ReviewSide::Before, ComparisonRead::Closure, ROUTE.into()),
            Event::HeadDocument,
            Event::Proof(ReviewSide::After, ComparisonRead::Document, ROUTE.into()),
            Event::HeadClosure,
            Event::Proof(ReviewSide::After, ComparisonRead::Closure, ROUTE.into()),
        ]
    );
    let recorder = prepared.recorder.as_ref().unwrap().clone();
    recorder.closure_union(
        &before,
        &after,
        [&prepared.resources.before, &prepared.resources.after],
    );
    let memo = memo();
    let recording = RecordingMemo {
        inner: &memo,
        before: &before,
        after: &after,
        recorder: &recorder,
    };
    let consumer = Consumer {
        moved: false,
        previous: None,
        current: None,
        component: None,
        paths: &paths,
        memo: &recording,
    };
    let mut result = PairViews::default();
    consumer
        .consume(
            &mut result,
            ViewKey {
                viewport: Some(Viewport::Desktop),
                color_scheme: ColorScheme::Light,
            },
            Some(ROUTE.into()),
            Some(ROUTE.into()),
            *prepared,
        )
        .unwrap();
    assert_eq!(recorder.len(), 14);
    let reads: Vec<_> = events
        .lock()
        .unwrap()
        .iter()
        .filter_map(|event| match event {
            Event::Proof(side, kind, route) => Some((*side, *kind, route.clone())),
            _ => None,
        })
        .collect();
    assert_eq!(reads.len(), 14);
    let expected = [ReviewSide::Before, ReviewSide::After]
        .into_iter()
        .flat_map(|side| {
            [
                (ComparisonRead::Document, ROUTE),
                (ComparisonRead::Closure, ROUTE),
                (ComparisonRead::Resource, "static/theme.css"),
                (ComparisonRead::Resource, "static/image.svg"),
                (ComparisonRead::Resource, "static/base.svg"),
                (ComparisonRead::Resource, "static/head.svg"),
                (ComparisonRead::Resource, "static/embedded.html"),
            ]
            .into_iter()
            .map(move |(kind, route)| (side, kind, route.to_owned()))
        })
        .collect::<BTreeSet<_>>();
    assert_eq!(reads.into_iter().collect::<BTreeSet<_>>(), expected);
    assert_eq!(result.views.len(), 1);
}
