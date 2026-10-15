//! Equal detail payloads cross generation boundaries without another encoding.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::namespace::viewer;
use unimock::{MockFn, Unimock, matching};

use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, ValidatedDetails};
use crate::replacement::encode_details;

use super::publication_support;

#[test]
fn unchanged_details_share_payload_and_encoded_bytes_across_rebuilds() {
    let origin = publication_support::snapshot(4, Arc::new(Unimock::new(())));
    let mut index = origin.index.clone();
    index.revision += 1;
    let details = origin
        .details
        .iter()
        .map(|(path, detail)| {
            let mut detail = detail.as_ref().clone();
            detail.revision = Some(index.revision);
            (path.clone(), detail)
        })
        .collect();
    let mut files = BTreeMap::new();
    let encoder = Unimock::new(());
    let reused = encode_details(details, &index, Some(&origin), &mut files, &encoder).unwrap();
    assert_eq!(reused.len(), origin.details.len());
    for (path, detail) in reused {
        assert!(Arc::ptr_eq(&detail, &origin.details[&path]));
        assert!(files.contains_key(&viewer(&format!("entries/{path}.json"))));
    }
}

#[test]
fn one_changed_detail_encodes_once_at_both_catalogue_sizes() {
    for count in [4, 16] {
        let origin = publication_support::snapshot(count, Arc::new(Unimock::new(())));
        let mut index = origin.index.clone();
        index.revision += 1;
        let mut details: BTreeMap<_, _> = origin
            .details
            .iter()
            .map(|(path, detail)| (path.clone(), detail.as_ref().clone()))
            .collect();
        details.get_mut("screen-0").unwrap().views[0].usage = publication_support::ready();
        let encoder = Unimock::new(
            DetailEncoderMock::encode
                .next_call(matching!(_, _, _))
                .answers(&|_, detail, index, schemas| {
                    ValidatedDetails.encode(detail, index, schemas)
                }),
        );
        let mut files = BTreeMap::new();
        let result = encode_details(details, &index, Some(&origin), &mut files, &encoder).unwrap();
        assert_eq!(result.len(), count);
        assert!(!Arc::ptr_eq(
            &result["screen-0"],
            &origin.details["screen-0"]
        ));
        assert!(Arc::ptr_eq(
            &result["screen-1"],
            &origin.details["screen-1"]
        ));
    }
}
