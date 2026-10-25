//! Equal detail payloads cross generation boundaries without another encoding.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::namespace::viewer;
use mokly_model::routes;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, ValidatedDetails};
use crate::replacement::encode_details;
use crate::replacement::reuse_usage;

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

#[test]
fn usage_requires_equal_document_keys_and_the_same_catalogue_deployment() {
    let mut origin = (*publication_support::snapshot(2, Arc::new(Unimock::new(())))).clone();
    for (path, detail) in &mut origin.details {
        let detail = Arc::make_mut(detail);
        for view in &mut detail.views {
            view.usage = publication_support::ready();
            origin.document_keys.insert(
                mokly_model::routes::view(path, view.viewport, view.color_scheme),
                "original".into(),
            );
        }
    }
    let pending = publication_support::snapshot(2, Arc::new(Unimock::new(())));
    for changed in [false, true] {
        let mut details: BTreeMap<_, _> = pending
            .details
            .iter()
            .map(|(path, detail)| (path.clone(), (**detail).clone()))
            .collect();
        let mut keys = origin.document_keys.clone();
        if changed {
            for key in keys.values_mut() {
                *key = "changed".into();
            }
        }
        let completed = reuse_usage(&mut details, &origin.index, &keys, Some(&origin));
        assert_eq!(completed.len(), if changed { 0 } else { keys.len() });
        for (path, detail) in &details {
            assert_eq!(
                detail.views[0].usage,
                if changed {
                    pending.details[path].views[0].usage.clone()
                } else {
                    publication_support::ready()
                }
            );
        }
    }
    for other_deployment in [false, true] {
        let mut details: BTreeMap<_, _> = pending
            .details
            .iter()
            .map(|(path, detail)| (path.clone(), (**detail).clone()))
            .collect();
        let mut index = origin.index.clone();
        if other_deployment {
            index.deployment_id = "another-process".into();
        } else {
            index.identity.id = "another-catalogue".into();
        }
        assert!(reuse_usage(&mut details, &index, &origin.document_keys, Some(&origin)).is_empty());
        assert_eq!(
            details["screen-0"].views[0].usage,
            pending.details["screen-0"].views[0].usage
        );
    }
}

#[test]
fn pending_or_failed_usage_is_not_recorded_as_a_reused_completion() {
    for usage in [CatalogueUsage::Pending, CatalogueUsage::Unavailable] {
        let pending = publication_support::snapshot(2, Arc::new(Unimock::new(())));
        let mut previous = (*pending).clone();
        for (path, detail) in &mut previous.details {
            let view = &mut Arc::make_mut(detail).views[0];
            view.usage = if path == "screen-0" {
                publication_support::ready()
            } else {
                usage.clone()
            };
            previous.document_keys.insert(
                routes::view(path, view.viewport, view.color_scheme),
                "same".into(),
            );
        }
        let mut details = pending
            .details
            .iter()
            .map(|(path, detail)| (path.clone(), (**detail).clone()))
            .collect();
        let completed = reuse_usage(
            &mut details,
            &previous.index,
            &previous.document_keys,
            Some(&previous),
        );
        assert_eq!(completed.len(), 1);
        assert!(completed.contains_key("screen-0/index.mobile.html"));
        assert_eq!(
            details["screen-0"].views[0].usage,
            publication_support::ready()
        );
        assert_eq!(details["screen-1"].views[0].usage, CatalogueUsage::Pending);
    }
}
