//! The builder keeps copies of only the anchors that an alias refers to.

use serde_json::json;

use super::Reader;

#[test]
fn only_the_aliased_anchor_of_two_is_kept() {
    let text = "a: &a [1]\nb: &b {k: 2}\nc: *b\n";
    let mut reader = Reader::new(text, "anchors.yaml", 1).unwrap();
    let document = reader.read().unwrap();
    assert_eq!(
        document.value,
        json!({"a": [1], "b": {"k": 2}, "c": {"k": 2}})
    );
    let kept: Vec<usize> = reader.anchors.keys().copied().collect();
    assert_eq!(kept, [2]);
    let copy = document.positions.get("/c/k").unwrap();
    assert_eq!((copy.line, copy.column), (2, 8));
}
