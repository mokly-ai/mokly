//! Opaque capture preserves typed input-change errors and checks existing output bounds first.

use mokly_graph::asset_delivery::{AssetRead, AssetReadMock};
use mokly_graph::closure::GeneratedResourcesMock;
use mokly_graph::error::GraphError;
use mokly_model::output::validation::FILE_LIMIT;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;

use super::generated;

#[test]
fn a_changed_asset_uses_the_existing_input_change_error() {
    let generation = Unimock::new(
        GeneratedResourcesMock::open_asset
            .next_call(matching!("assets/a.svg"))
            .answers(&|_, _| {
                Ok(Some(Box::new(Unimock::new((
                    AssetReadMock::length.each_call(matching!()).returns(6u64),
                    AssetReadMock::copy_to
                        .next_call(matching!(_))
                        .answers(&|_, _| {
                            Err(GraphError::InputsChanged {
                                path: "/repo/a.svg".into(),
                            })
                        }),
                ))) as Box<dyn AssetRead>))
            }),
    );
    assert!(
        matches!(generated(&generation, "assets/a.svg"), Err(Error::InputsChanged { path }) if path.to_string_lossy() == "/repo/a.svg")
    );
}

#[test]
fn an_oversized_asset_fails_before_copy_or_allocation() {
    let generation = Unimock::new(
        GeneratedResourcesMock::open_asset
            .next_call(matching!("assets/a.svg"))
            .answers(&|_, _| {
                Ok(Some(Box::new(Unimock::new(
                    AssetReadMock::length
                        .next_call(matching!())
                        .returns(FILE_LIMIT as u64 + 1),
                )) as Box<dyn AssetRead>))
            }),
    );
    assert!(
        matches!(generated(&generation, "assets/a.svg"), Err(Error::TooLarge { path }) if path == "assets/a.svg")
    );
}

#[test]
fn one_verified_asset_copy_becomes_the_immutable_output_payload() {
    let generation = Unimock::new(
        GeneratedResourcesMock::open_asset
            .next_call(matching!("assets/a.svg"))
            .answers(&|_, _| {
                Ok(Some(Box::new(Unimock::new((
                    AssetReadMock::length.each_call(matching!()).returns(6u64),
                    AssetReadMock::copy_to
                        .next_call(matching!(_))
                        .answers(&|_, output| {
                            output.write_all(b"opaque").unwrap();
                            Ok(())
                        }),
                ))) as Box<dyn AssetRead>))
            }),
    );
    assert_eq!(
        generated(&generation, "assets/a.svg").unwrap().unwrap(),
        b"opaque"
    );
}
