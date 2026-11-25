//! Complete persistent records preserve every composition field across a codec restart.

use std::collections::BTreeMap;

use mokly_catalogue::diagnostic::{STORY_RENDER_FAILED, Warning, WarningSubject};
use mokly_model::data::DataValue;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord};
use mokly_model::wire_props;

use crate::document_codec::EncodedView;
use crate::document_codec::document_codec_tests::artifact;
use crate::document_error::{CodecError, CodecInternalError};

#[test]
fn persistent_records_restore_all_metadata_and_exact_bytes() {
    let mut input = artifact(Vec::new());
    let warnings = &mut input.document.as_mut().unwrap().warnings;
    warnings[0].code = "html-foster-parented";
    warnings.push(Warning {
        code: STORY_RENDER_FAILED,
        subject: WarningSubject::Route("menu/index.mobile.html".into()),
        message: "story \"menu.stories.tsx#Open\" could not render: document is not defined".into(),
    });
    let (encoded, identity) = EncodedView::encode_identified(&input).unwrap();
    let bytes = stored(&encoded);
    assert!(
        bytes.is_some(),
        "complete document must have a persistent record"
    );
    let output = EncodedView::from_stored(&bytes.unwrap())
        .unwrap()
        .restore()
        .unwrap();
    assert_eq!(output.bytes, input.bytes);
    assert_eq!(output.content_type, input.content_type);
    assert_eq!(EncodedView::comparison_identity(&output).unwrap(), identity);
    let before = input.document.unwrap();
    let after = output.document.unwrap();
    assert_eq!(after.tree, before.tree);
    assert_eq!(after.usage, before.usage);
    assert_eq!(after.resources, before.resources);
    assert_eq!(after.components, before.components);
    assert_eq!(after.warnings, before.warnings);
    assert_eq!(after.links.len(), before.links.len());
    assert_eq!(after.links[0].source_route, before.links[0].source_route);
    assert_eq!(after.links[0].target, before.links[0].target);
    assert_eq!(after.links[0].fragment, before.links[0].fragment);
}

#[test]
fn persistent_lengths_are_rejected_before_restoration_allocates_them() {
    let mut input = artifact(Vec::new());
    input.document.as_mut().unwrap().warnings.clear();
    let encoded = EncodedView::encode(&input).unwrap();
    let bytes = stored(&encoded).unwrap();
    for offset in [8, 16, 24, 32, 40] {
        let mut damaged = bytes.clone();
        damaged[offset..offset + 8].copy_from_slice(&u64::MAX.to_le_bytes());
        assert!(
            matches!(
                EncodedView::from_stored(&damaged),
                Err(CodecError::Internal(CodecInternalError::InvalidLength))
            ),
            "declared allocation at offset {offset} must be rejected"
        );
    }
}

#[test]
fn persistent_usage_preserves_props_at_the_64_level_limit() {
    let mut input = artifact(Vec::new());
    let mut value = DataValue::Null;
    for _ in 0..63 {
        value = DataValue::Object(BTreeMap::from([("child".into(), value)]));
    }
    let props = BTreeMap::from([("deep".into(), value)]);
    let document = input.document.as_mut().unwrap();
    document.warnings.clear();
    document.usage = CatalogueUsage::Ready {
        instances: vec![ComponentInstanceRecord {
            key: "instance".into(),
            id: "local".into(),
            component_id: "card".into(),
            owner: ComponentInputOwner::Entry,
            slot_key: None,
            order: 0,
            props: wire_props::encode(&props),
            props_key: "props".into(),
            source: None,
        }],
        slots: vec![],
        ranges: vec![],
    };
    let bytes = stored(&EncodedView::encode(&input).unwrap()).unwrap();
    let decoded = EncodedView::from_stored(&bytes);
    assert!(
        decoded.is_ok(),
        "valid 64-level props must survive persistent decoding"
    );
    let restored = decoded.unwrap().restore().unwrap();
    assert_eq!(
        restored.document.unwrap().usage,
        input.document.unwrap().usage
    );
}

fn stored(encoded: &EncodedView) -> Option<Vec<u8>> {
    let mut bytes = vec![0; 1024 * 1024];
    let length = encoded.write_stored(&mut bytes, None).unwrap()?;
    bytes.truncate(length);
    Some(bytes)
}
