//! The independent receiver accepts a real publication and rejects each altered copy of it.

use std::collections::BTreeMap;

use mokly_test_support::inventory::{self, MARKER};
use mokly_test_support::publication::{self, Outputs};
use mokly_test_support::receiver::{Exchange, Options};
use mokly_test_support::upload::{self, Rejection};
use serde_json::{Map, Value, json};

use super::support::mokly;

type Files = BTreeMap<String, Vec<u8>>;

fn altered(files: &Files, change: impl FnOnce(&mut Files)) -> Files {
    let mut copy = files.clone();
    change(&mut copy);
    copy
}

#[test]
fn the_independent_receiver_checks_a_real_publication_and_rejects_missing_extra_and_changed_bytes()
{
    let root = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options::default());
    let result =
        publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[]).run();
    let mut outputs = Outputs::default();
    outputs.push(publication::directory(&result.stdout));
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let artifact = receiver.record().completed_inventories.remove(0);
    receiver.close();
    assert!(inventory::verify(&artifact).unwrap().len() > 3);
    let metadata = &artifact["mokly-upload.json"];
    upload::metadata(metadata).unwrap();
    let size = artifact["index.html"].len();
    for files in [
        altered(&artifact, |files| {
            files.remove(MARKER);
        }),
        altered(&artifact, |files| {
            files.remove("index.html");
        }),
        altered(&artifact, |files| {
            files.insert("extra".to_owned(), b"x".to_vec());
        }),
        altered(&artifact, |files| {
            files.insert("index.html".to_owned(), b"corrupt".to_vec());
        }),
        altered(&artifact, |files| {
            files.insert("index.html".to_owned(), vec![b'?'; size]);
        }),
    ] {
        assert_eq!(
            inventory::verify(&files).map(|_| ()),
            Err(Rejection::Invalid)
        );
    }
    let marker = json!({
        "schemaVersion": 3,
        "files": [{ "path": "x", "sha256": inventory::digest(b"x"), "size": 1 }],
    });
    let repeated = marker.to_string().replace(
        r#""schemaVersion":3"#,
        r#""schemaVersion":3,"schemaVersion":3"#,
    );
    assert_eq!(
        inventory::ownership(repeated.as_bytes()).map(|_| ()),
        Err(Rejection::Invalid)
    );
    let envelope: Map<String, Value> = serde_json::from_slice(metadata).unwrap();
    let with = |field: &str, value: Value| {
        let mut changed = envelope.clone();
        changed.insert(field.to_owned(), value);
        upload::metadata(&serde_json::to_vec(&changed).unwrap()).map(|_| ())
    };
    for version in [json!(1), json!(3), json!("2")] {
        assert_eq!(
            with("schemaVersion", version),
            Err(Rejection::UnsupportedVersion)
        );
    }
    for version in ["01.2.3", "1.2.3-01", "1.2.3-a..b", "1.2.3+empty..segment"] {
        assert_eq!(
            with("moklyVersion", json!(version)),
            Err(Rejection::Invalid),
            "{version}"
        );
    }
    let large = "999999999999999999999.2.3-alpha.1+build.9";
    assert_eq!(with("moklyVersion", json!(large)), Ok(()));
    assert_eq!(with("extra", json!(true)), Err(Rejection::Invalid));
}
