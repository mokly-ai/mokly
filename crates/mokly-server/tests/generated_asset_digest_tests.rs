//! Verified generated asset delivery uses the generation's recorded digest.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_graph::asset_delivery::{AssetRead, AssetReadMock};
use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::types::RenderGenerationMock;
use mokly_server::asset_streams::TemporaryAssets;
use mokly_server::backend::{Documents, GraphDocuments};
use mokly_server::public_read::ConfinedReader;
use mokly_server::warnings::TracingWarnings;
use unimock::{MockFn, Unimock, matching};

#[test]
fn generated_asset_reads_the_recorded_digest_after_verification() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let generation = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        GeneratedResourcesMock::open_asset
            .some_call(matching!("assets/font.woff2"))
            .answers_arc(Arc::new({
                let events = events.clone();
                move |_, _| {
                    let stream = Unimock::new((
                        AssetReadMock::length.each_call(matching!()).returns(3u64),
                        AssetReadMock::copy_to
                            .some_call(matching!(_))
                            .answers_arc(Arc::new({
                                let events = events.clone();
                                move |_, output| {
                                    output.write_all(b"abc").unwrap();
                                    events.lock().unwrap().push("verified copy");
                                    Ok(())
                                }
                            })),
                    ));
                    Ok(Some(Box::new(stream) as Box<dyn AssetRead>))
                }
            })),
        RenderGenerationMock::resource_digest
            .some_call(matching!("static/mokly-generated/assets/font.woff2"))
            .answers_arc(Arc::new({
                let events = events.clone();
                move |_, _| {
                    events.lock().unwrap().push("recorded digest");
                    Ok(Some(
                        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".into(),
                    ))
                }
            })),
    ))
    .no_verify_in_drop();
    let documents = GraphDocuments::new(
        Arc::new(generation),
        Arc::new(ConfinedReader {
            repo_root: Default::default(),
            policy: Arc::new(Unimock::new(())),
        }),
        Arc::new(TracingWarnings),
        Arc::new(TemporaryAssets),
    );
    let result = documents
        .asset_request("assets/font.woff2")
        .capture()
        .unwrap();
    assert!(result.is_some(), "a verified asset must be available");
    assert_eq!(
        *events.lock().unwrap(),
        ["verified copy", "recorded digest"]
    );
}
