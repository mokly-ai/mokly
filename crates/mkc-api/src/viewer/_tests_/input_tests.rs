//! Opaque cursor scope, compound ordering and strict query contracts.

use mkc_store_interface::viewer::{BranchKey, HistoryFilter, PublicationKey};
use url::form_urlencoded;
use uuid::Uuid;

use crate::viewer::cursor::{self, Key, Scope};
use crate::viewer::input::{Action, Query, Read};

use super::support::{PROJECT, PUBLICATION, now};

#[test]
fn screen_query_enforces_the_decoded_utf8_identity_boundary() {
    let share = Action {
        project: PROJECT,
        read: Read::Share(PUBLICATION),
    };
    for (id, shareable) in [
        ("a".repeat(2048), true),
        ("a".repeat(2049), false),
        ("Product/Screen_1".into(), true),
        ("a/mokly-generated".into(), true),
        ("é".repeat(1024), false),
        (format!("{}a", "é".repeat(1024)), false),
        ("aux".into(), false),
        ("a/CON".into(), false),
        ("COM9".into(), false),
        ("a/Lpt1".into(), false),
        ("MOKLY-GENERATED/a".into(), false),
        ("a//b".into(), false),
        ("a.b".into(), false),
        ("a b".into(), false),
        ("a\\b".into(), false),
        ("a%2Fb".into(), false),
    ] {
        let query = form_urlencoded::Serializer::new(String::new())
            .append_pair("catalogueScreen", &id)
            .finish();
        assert_eq!(Query::parse(share, &query).is_ok(), shareable, "{id:?}");
    }
    assert_eq!(
        Query::parse(share, "catalogueScreen=Product%2FScreen_1")
            .unwrap()
            .selection
            .screen
            .as_ref()
            .map(|path| path.as_str()),
        Some("Product/Screen_1")
    );
}

#[test]
fn screen_cursors_require_a_shareable_current_path_and_the_same_publication() {
    let scope = Scope::Screens(PROJECT, PUBLICATION);
    let key = Key::Screen("Product/Screen_1".parse().unwrap());
    let value = cursor::encode(&scope, key.clone()).unwrap();
    assert_eq!(cursor::decode(&value, &scope).unwrap(), key);
    assert!(cursor::decode(&value, &Scope::Screens(PROJECT, Uuid::from_u128(88).into())).is_err());
    for path in [
        "a//b".to_owned(),
        "a/CON".into(),
        "mokly-generated/a".into(),
        "a".repeat(2049),
    ] {
        let mut document = serde_json::to_value(&key).unwrap();
        document["Screen"] = serde_json::Value::String(path);
        let raw = serde_json::json!({"version": 1, "scope": scope, "key": document});
        let value = serde_json::to_vec(&raw)
            .unwrap()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert!(cursor::decode(&value, &scope).is_err());
    }
}

#[test]
fn history_filters_and_cursor_scopes_are_exact() {
    let filter = HistoryFilter {
        branch: Some("feat/a + b".into()),
        pull_request: Some(7),
    };
    let scope = Scope::History(PROJECT, filter.clone());
    let key = Key::Publication(PublicationKey {
        created_at: now(),
        id: PUBLICATION,
    });
    let value = cursor::encode(&scope, key.clone()).unwrap();
    assert_eq!(cursor::decode(&value, &scope).unwrap(), key);
    for wrong in [
        Scope::History(Uuid::from_u128(99).into(), filter),
        Scope::History(PROJECT, HistoryFilter::default()),
        Scope::Branches(PROJECT),
    ] {
        assert!(cursor::decode(&value, &wrong).is_err());
    }
    let query = Query::parse(
        Action {
            project: PROJECT,
            read: Read::History,
        },
        &format!("branch=feat%2Fa+%2B+b&pullRequest=7&limit=1&cursor={value}"),
    )
    .unwrap();
    assert_eq!(query.limit, 1);
    assert_eq!(query.after, Some(key));
}

#[test]
fn compound_keys_survive_missing_anchors_and_pages_use_lookahead() {
    let scope = Scope::Branches(PROJECT);
    let key = |name: &String| {
        Key::Branch(BranchKey {
            is_default: name == "main",
            name: name.clone(),
        })
    };
    let first = cursor::page(vec!["main".into(), "a".into(), "z".into()], 2, &scope, key).unwrap();
    assert_eq!(first.items, ["main", "a"]);
    assert_eq!(
        cursor::decode(first.next_cursor.as_ref().unwrap(), &scope).unwrap(),
        key(&"a".into())
    );
    assert!(
        cursor::page(vec!["z".into()], 2, &scope, key)
            .unwrap()
            .next_cursor
            .is_none()
    );
    for value in ["", "0", "xyz", "FF", "00", "7b7d"] {
        assert!(cursor::decode(value, &scope).is_err());
    }
}

#[test]
fn lists_and_share_reject_unknown_duplicate_and_out_of_range_values() {
    let list = Action {
        project: PROJECT,
        read: Read::History,
    };
    for value in [
        "limit=0",
        "limit=101",
        "limit=-1",
        "limit=2&limit=2",
        "branch=",
        "branch=%00",
        "branch=a&branch=b",
        "pullRequest=0",
        "pullRequest=-1",
        "pullRequest=1.1",
        "cursor=no",
        "extra=1",
    ] {
        assert!(Query::parse(list, value).is_err(), "{value}");
    }
    assert_eq!(Query::parse(list, "").unwrap().limit, 50);
    assert_eq!(Query::parse(list, "limit=100").unwrap().limit, 100);
    let share = Action {
        project: PROJECT,
        read: Read::Share(PUBLICATION),
    };
    for value in [
        "thread=abc",
        "thread=",
        "view=changes",
        "panel=share",
        "viewport=tablet",
        "scheme=system",
        "screen=legacy",
        "catalogueScreen=",
        "catalogueScreen=x&catalogueScreen=y",
        "limit=10",
    ] {
        assert!(Query::parse(share, value).is_err(), "{value}");
    }
    assert!(Query::parse(share, "viewport=mobile&scheme=dark&catalogueScreen=welcome").is_ok());
    assert!(
        Query::parse(
            Action {
                project: PROJECT,
                read: Read::Publication(PUBLICATION)
            },
            "cursor=a"
        )
        .is_err()
    );
}
