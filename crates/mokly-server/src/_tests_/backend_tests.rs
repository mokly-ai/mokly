//! Authored requests ask for membership and a handle without copying reached sets.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::asset_delivery::{AssetRead, AssetReadMock};
use mokly_graph::cache::Artifact;
use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::types::{RenderGenerationMock, TemporaryDocument};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, GraphDocuments};
use crate::error::ServerError;
use crate::preview::MAX_BYTES;
use crate::public_read::PublicReaderMock;
use crate::warnings::{RenderWarningsMock, TracingWarnings};
use crate::work::{Work, Workers};

#[test]
fn generated_document_reads_do_not_return_stylesheet_resources() {
    let route = "styles/css/base.css";
    let graph = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::resource_routes
            .each_call(matching!())
            .returns(vec![route.into()]),
        GeneratedResourcesMock::resource
            .some_call(matching!("styles/css/base.css"))
            .returns(Ok(Some(b"main{color:red}".to_vec()))),
    ))
    .no_verify_in_drop();
    let documents = GraphDocuments::new(
        Arc::new(graph),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    let file = documents.generated(route).unwrap();
    assert!(
        file.is_none(),
        "document read returned a resource: {file:?}"
    );
}

#[test]
fn stylesheet_reads_graph_bytes_each_time_and_revalidates_the_tag() {
    let route = "styles/css/base.css";
    let reads = Arc::new(AtomicUsize::new(0));
    let graph = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::resource_routes
            .each_call(matching!())
            .returns(vec![route.into()]),
        GeneratedResourcesMock::resource
            .each_call(matching!("styles/css/base.css"))
            .answers_arc({
                let reads = reads.clone();
                Arc::new(move |_, _| {
                    let bytes = if reads.fetch_add(1, Ordering::SeqCst) < 2 {
                        b"main{color:red}"
                    } else {
                        b"main{color:tan}"
                    };
                    Ok(Some(bytes.to_vec()))
                })
            }),
    ));
    let documents = GraphDocuments::new(
        Arc::new(graph),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    let red_tag = "\"69cd51d645398b30c39d71a966b6f693e0dcb788d3841dff607d557e096b4f72\"";
    let tan_tag = "\"1ae69b512e1a80e5b9b2212e059e944d2a5e8b44672d936ef61a9956e0262ae9\"";
    for (index, (bytes, tag)) in [
        (b"main{color:red}", red_tag),
        (b"main{color:red}", red_tag),
        (b"main{color:tan}", tan_tag),
    ]
    .into_iter()
    .enumerate()
    {
        let stylesheet = documents.stylesheet(route).unwrap().unwrap();
        assert_eq!(
            reads.load(Ordering::SeqCst),
            index + 1,
            "each stylesheet request must read the graph once"
        );
        assert_eq!(stylesheet.file.bytes.as_ref(), bytes);
        assert_eq!(stylesheet.etag, tag);
    }
}

#[tokio::test]
async fn authored_reads_check_one_membership_and_open_one_handle_per_request() {
    let workers = Workers::new(1, Arc::new(Unimock::new(())));
    for count in [8, 32] {
        let generation = Unimock::new((
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(BTreeMap::new()),
            RenderGenerationMock::contains_public_file
                .each_call(matching!("assets/large.bin"))
                .returns(true)
                .n_times(count),
        ));
        let reader = Unimock::new(
            PublicReaderMock::open
                .each_call(matching!("assets/large.bin"))
                .answers(&|_, _| None)
                .n_times(count),
        );
        {
            let documents = Arc::new(GraphDocuments::new(
                Arc::new(generation.clone()),
                Arc::new(reader.clone()),
                Arc::new(TracingWarnings),
                Arc::new(Unimock::new(())),
            ));
            for _ in 0..count {
                assert!(
                    workers
                        .authored(documents.clone(), "assets/large.bin".into())
                        .await
                        .unwrap()
                        .is_none()
                );
            }
        }
    }
}

#[test]
fn preview_asset_capacity_is_checked_before_copying_any_payload() {
    let mut rendered = TemporaryDocument {
        artifact: Arc::new(Artifact {
            bytes: b"<p>Home</p>".to_vec(),
            content_type: "text/html".into(),
            document: None,
            fragment: None,
        }),
        closure: Default::default(),
    };
    rendered
        .closure
        .edges
        .insert("static/mokly-generated/assets/a.svg".into(), vec![]);
    let mock = Unimock::new((
        RenderGenerationMock::plans
            .next_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::render_props
            .next_call(matching!("home/index.html", _))
            .returns(Ok(rendered)),
        GeneratedResourcesMock::open_asset
            .next_call(matching!("assets/a.svg"))
            .answers(&|_, _| {
                Ok(Some(Box::new(Unimock::new(
                    AssetReadMock::length
                        .next_call(matching!())
                        .returns(MAX_BYTES as u64),
                )) as Box<dyn AssetRead>))
            }),
        RenderWarningsMock::report
            .next_call(matching!((warnings, failed) if warnings.is_empty() && *failed))
            .returns(()),
    ));
    let documents = GraphDocuments::new(
        Arc::new(mock.clone()),
        Arc::new(Unimock::new(())),
        Arc::new(mock),
        Arc::new(Unimock::new(())),
    );
    assert!(matches!(
        documents.preview("home/index.html", &Default::default()),
        Err(ServerError::PreviewCapacity)
    ));
}
