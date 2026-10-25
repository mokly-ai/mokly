//! Authored requests ask for membership and a handle without copying reached sets.

use std::collections::BTreeMap;
use std::sync::Arc;

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

#[test]
fn authored_reads_check_one_membership_and_open_one_handle_per_request() {
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
            let documents = GraphDocuments::new(
                Arc::new(generation.clone()),
                Arc::new(reader.clone()),
                Arc::new(TracingWarnings),
                Arc::new(Unimock::new(())),
            );
            for _ in 0..count {
                assert!(documents.authored("assets/large.bin").is_none());
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
