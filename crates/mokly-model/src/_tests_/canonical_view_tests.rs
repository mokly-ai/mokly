//! The snapshot view accepts only canonical bytes and keeps their order and spelling.

use super::pretty;

#[test]
fn canonical_bytes_get_an_indented_view_with_the_same_order_and_numbers() {
    let text = "{\"a\":[1.0,-0.0,1e+16],\"b\":{\"c\":null},\"😀\":\"x\"}\n";
    let expected = concat!(
        "{\n",
        "  \"a\": [\n",
        "    1.0,\n",
        "    -0.0,\n",
        "    1e+16\n",
        "  ],\n",
        "  \"b\": {\n",
        "    \"c\": null\n",
        "  },\n",
        "  \"😀\": \"x\"\n",
        "}\n"
    );
    assert_eq!(pretty(text).as_deref(), Some(expected));
}

#[test]
fn bytes_that_are_not_canonical_get_no_view() {
    for text in [
        "{\"b\":1,\"a\":2}\n",
        "{\"a\": 1}\n",
        "{\"a\":1}",
        "{\"a\":1.5e16}\n",
        "not json",
    ] {
        assert_eq!(pretty(text), None, "{text}");
    }
}
