//! Losing parses return the receipt of the first stored edges, including unknown input.

use crate::reference_index::{MemoryReferenceIndex, ReferenceIndex};

#[test]
fn later_parse_keeps_the_first_edges_receipt_even_if_that_receipt_is_unknown() {
    for original in [None, Some([1; 32])] {
        let index = MemoryReferenceIndex::default();
        index
            .parse_identified("static/theme.css", b"@import 'first.css';", original)
            .unwrap();
        let returned = index
            .parse_identified("static/theme.css", b"@import 'second.css';", Some([2; 32]))
            .unwrap();
        assert_eq!(returned.urls, ["first.css"]);
        assert_eq!(
            returned.identity, original,
            "the receipt belongs to the returned edges"
        );
        assert_eq!(index.get_identified("static/theme.css"), Some(returned));
    }
}
