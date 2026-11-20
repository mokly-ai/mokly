//! An overflowing record survives publication in the same fixed buffer.

use std::io::Cursor;

use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::StoreKey;
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;

use crate::render_segment;
use crate::render_segment_buffer::{Append, SegmentBuffer};

fn document(bytes: &[u8]) -> EncodedView {
    EncodedView::encode(&Artifact {
        bytes: bytes.to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![],
            usage: CatalogueUsage::Pending,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    })
    .unwrap()
}

#[test]
fn a_full_segment_preserves_the_next_record_and_reuses_its_fixed_capacity() {
    let first = StoreKey::new(&NodeKey("first".into()), "build");
    let second = StoreKey::new(&NodeKey("second".into()), "build");
    let mut buffer = SegmentBuffer::new(384).unwrap();
    assert_eq!(buffer.storage_bytes(), 33_548);
    assert_eq!(
        buffer.append(&first, &document(b"alpha"), None),
        Append::Added,
        "a bounded record must append in place"
    );
    assert_eq!(
        buffer.append(&second, &document(b"beta"), None),
        Append::Full
    );
    {
        let built = buffer.finish("current").unwrap();
        assert_eq!(built.documents(), 1);
        let mut input = Cursor::new(built.bytes());
        let (header, start, _) =
            render_segment::header(&mut input, built.bytes().len() as u64, "current", true)
                .unwrap();
        let bytes = render_segment::document(&mut input, &header, start, &first).unwrap();
        assert_eq!(
            EncodedView::from_stored(&bytes)
                .unwrap()
                .restore()
                .unwrap()
                .bytes,
            b"alpha"
        );
    }
    buffer.advance();
    {
        let built = buffer.finish("current").unwrap();
        assert_eq!(built.documents(), 1);
        let mut input = Cursor::new(built.bytes());
        let (header, start, _) =
            render_segment::header(&mut input, built.bytes().len() as u64, "current", true)
                .unwrap();
        let bytes = render_segment::document(&mut input, &header, start, &second);
        assert!(
            bytes.is_ok(),
            "the carried record must keep its key and checksum"
        );
        let bytes = bytes.unwrap();
        assert_eq!(
            EncodedView::from_stored(&bytes)
                .unwrap()
                .restore()
                .unwrap()
                .bytes,
            b"beta"
        );
    }
    buffer.advance();
    assert!(buffer.finish("current").is_none());
    assert_eq!(buffer.storage_bytes(), 33_548);
}
