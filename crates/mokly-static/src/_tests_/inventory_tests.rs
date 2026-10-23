//! Portable paths and collisions are refused at insertion, before any write.

use crate::error::Error;
use crate::inventory::Inventory;

#[test]
fn rejects_unsafe_names_and_each_collision_direction() {
    for path in [
        "",
        "../a",
        "/a",
        "a//b",
        "a:b",
        "a\\b",
        "a\u{85}b",
        ".mokly-export-artifact",
        ".MOKLY-export-artifact/child",
    ] {
        let mut inventory = Inventory::default();
        assert!(
            inventory
                .insert(path.into(), b"".as_slice().into())
                .is_err(),
            "{path:?}"
        );
    }
    for (first, second) in [("a", "A"), ("a", "a/b"), ("A/b", "a")] {
        let mut inventory = Inventory::default();
        inventory
            .insert(first.into(), b"x".as_slice().into())
            .unwrap();
        assert!(matches!(
            inventory.insert(second.into(), b"x".as_slice().into()),
            Err(Error::Collision { .. })
        ));
    }
    let mut inventory = Inventory::default();
    for path in ["ß.html", "ss.html", "a\u{200d}b", "a+b.js", "覆盖.pdf"] {
        inventory
            .insert(path.into(), b"x".as_slice().into())
            .unwrap();
    }
    assert_eq!(inventory.into_files().len(), 5);
}

#[test]
fn portable_error_quotes_category_cc_characters_as_lowercase_json_escapes() {
    let error = Error::Portable {
        path: "a\u{85}\u{7f}\n\"b".into(),
    };
    assert_eq!(
        error.to_string(),
        "[mokly-static] The output path \"a\\u0085\\u007f\\n\\\"b\" is not portable. Rename that file or folder, then build again."
    );
}
