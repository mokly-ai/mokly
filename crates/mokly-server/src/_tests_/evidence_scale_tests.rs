//! Operation counts cover unchanged views, repeated routes, and batch growth.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, ValidatedDetails};
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::{ready, snapshot};

#[test]
fn publication_reads_and_encodes_each_changed_detail_once_at_one_to_four_scale() {
    let mut counts = Vec::new();
    for size in [8, 32] {
        let reads = Arc::new(AtomicUsize::new(0));
        let encodes = Arc::new(AtomicUsize::new(0));
        let mock = Unimock::new((
            DocumentsMock::usage
                .each_call(matching!(_))
                .answers_arc(Arc::new({
                    let reads = reads.clone();
                    move |_, _| {
                        reads.fetch_add(1, Ordering::SeqCst);
                        Some(ready())
                    }
                })),
            DetailEncoderMock::encode
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new({
                    let encodes = encodes.clone();
                    move |_, detail, index, schemas| {
                        encodes.fetch_add(1, Ordering::SeqCst);
                        ValidatedDetails.encode(detail, index, schemas)
                    }
                })),
        ));
        let origin = snapshot(size, Arc::new(mock.clone()));
        let mut shared = SharedPublication::new(origin.clone());
        shared.encoder = Arc::new(mock.clone());
        shared
            .completed(&origin, "screen-0/index.mobile.html")
            .unwrap();
        assert_eq!(reads.load(Ordering::SeqCst), 1);
        assert_eq!(encodes.load(Ordering::SeqCst), 1);
        let first = shared.current();
        assert!(Arc::ptr_eq(&first.generation, &origin.generation));
        assert!(Arc::ptr_eq(
            &first.details["screen-1"],
            &origin.details["screen-1"]
        ));
        for _ in 0..size {
            shared
                .completed(&origin, "screen-0/index.mobile.html")
                .unwrap();
            shared.completed(&origin, "page/index.html").unwrap();
        }
        assert_eq!(shared.current().index.revision, 2);
        assert_eq!(reads.load(Ordering::SeqCst), 1);
        assert_eq!(encodes.load(Ordering::SeqCst), 1);
        let routes = origin
            .routes
            .iter()
            .map(|route| route.route.clone())
            .collect::<Vec<_>>();
        shared.completed_many(&origin, &routes).unwrap();
        assert_eq!(reads.load(Ordering::SeqCst), size);
        assert_eq!(encodes.load(Ordering::SeqCst), size + 1);
        assert!(
            shared
                .current()
                .details
                .values()
                .all(|detail| detail.workspace.is_some())
        );
        counts.push((reads.load(Ordering::SeqCst), encodes.load(Ordering::SeqCst)));
    }
    assert!(counts[0].0 > 0 && counts[0].1 > 0);
    assert_eq!(counts[1].0, counts[0].0 * 4);
    assert!(counts[1].1 * 2 <= counts[0].1 * 9);
}
