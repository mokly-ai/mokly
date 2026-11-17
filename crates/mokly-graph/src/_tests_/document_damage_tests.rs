//! Damaged compact documents fail through the typed codec boundary.

use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::parse;

use crate::document_error::{CodecError, CodecInternalError};
use crate::document_nodes::{self, FlatNode};

use super::document_codec_tests::artifact;
use super::{EncodedView, Payload};

#[test]
fn damaged_payloads_and_invalid_child_counts_return_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    let mut encoded = EncodedView::encode(&input).unwrap();
    encoded.invalidate_payload();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::Io { .. }))
    ));
    let mut tree = document_nodes::flatten(&input.document.as_ref().unwrap().tree);
    let FlatNode::Element { children, .. } = &mut tree[0] else {
        panic!("element")
    };
    *children = 2;
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&input.bytes).unwrap();
    let tree = postcard::to_stdvec(&Payload { tree }).unwrap();
    encoded.tree_len = tree.len();
    encoder.write_all(&tree).unwrap();
    encoded.payload = encoder.finish().unwrap().into_boxed_slice();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::InvalidTree))
    ));
}

#[test]
fn truncated_zlib_tails_return_compression_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    for removed in 1..=4 {
        let mut encoded = EncodedView::encode(&input).unwrap();
        encoded.payload = encoded.payload[..encoded.payload.len() - removed].into();
        assert!(
            matches!(
                encoded.restore(),
                Err(CodecError::Internal(CodecInternalError::Io { .. }))
            ),
            "a zlib tail missing {removed} bytes must fail"
        );
    }
}

#[test]
fn corrupt_zlib_checksums_return_compression_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    let mut encoded = EncodedView::encode(&input).unwrap();
    let mut damaged = encoded.payload.to_vec();
    *damaged.last_mut().unwrap() ^= 1;
    encoded.payload = damaged.into_boxed_slice();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::Io { .. }))
    ));
}

#[test]
fn trailing_inflated_tree_bytes_return_length_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    let mut encoded = EncodedView::encode(&input).unwrap();
    let mut inflated = Vec::new();
    ZlibDecoder::new(encoded.payload.as_ref())
        .read_to_end(&mut inflated)
        .unwrap();
    inflated.push(0);
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&inflated).unwrap();
    encoded.payload = encoder.finish().unwrap().into_boxed_slice();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::InvalidLength))
    ));
    encoded.tree_len += 1;
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::InvalidLength))
    ));
}

#[test]
fn truncated_tree_bodies_return_compression_errors() {
    let input = artifact(parse::html(DeliveredHtml::fragment("<p>text</p>")));
    let mut encoded = EncodedView::encode(&input).unwrap();
    let mut inflated = Vec::new();
    ZlibDecoder::new(encoded.payload.as_ref())
        .read_to_end(&mut inflated)
        .unwrap();
    inflated.pop();
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&inflated).unwrap();
    encoded.payload = encoder.finish().unwrap().into_boxed_slice();
    assert!(
        matches!(encoded.restore(), Err(CodecError::Internal(CodecInternalError::Io {
        source,
    })) if source.kind() == std::io::ErrorKind::UnexpectedEof)
    );
}

/// One text record declares 16,384 string bytes but supplies no body.
#[test]
fn malformed_string_length_returns_a_binary_error() {
    let input = artifact(vec![]);
    let mut encoded = EncodedView::encode(&input).unwrap();
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&input.bytes).unwrap();
    let tree = postcard::to_stdvec(&(1_usize, 2_u32, 16_384_usize)).unwrap();
    encoded.tree_len = tree.len();
    encoder.write_all(&tree).unwrap();
    encoded.payload = encoder.finish().unwrap().into_boxed_slice();
    assert!(matches!(
        encoded.restore(),
        Err(CodecError::Internal(CodecInternalError::Binary {
            source: postcard::Error::DeserializeUnexpectedEnd,
        }))
    ));
}
