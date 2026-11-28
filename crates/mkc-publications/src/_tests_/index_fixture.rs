//! Synthetic index read fields and the released producer index for behavior tests.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::limits::Limits;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::stored_index::{BoundedStoredIndexReader, LoadedIndex, StoredIndexReader};

pub(super) const RELEASED_BYTES: &[u8] =
    include_bytes!("../../../mkc-mokly-contract/fixtures/index-v9.json");

pub(super) fn parse(value: &Value) -> CatalogueIndex {
    CatalogueIndex::parse(&serde_json::to_vec(value).unwrap(), Limits::default()).unwrap()
}

pub(super) fn released() -> CatalogueIndex {
    parse(&serde_json::from_slice(RELEASED_BYTES).unwrap())
}

pub(super) fn empty() -> Value {
    json!({
        "schemaVersion": 9,
        "base": "main",
        "baseCommit": "cccccccccccccccccccccccccccccccccccccccc",
        "changesStatus": "ready",
        "comparisonUrl": "mokly-viewer/diffs/generations/0000000000000000000000000000000000000000000000000000000000000000/",
        "components": [], "documents": [], "pages": [], "screens": [],
        "useCases": [], "removedEntries": []
    })
}

pub(super) fn record(path: &str, title: &str, kind: &str) -> Value {
    json!({ "path": path, "title": title,
        "changes": { "status": "ready", "kind": kind, "included": true },
        "views": [{ "viewport": "desktop", "colorScheme": "light" }]
    })
}

pub(super) fn current_document(status: &str) -> Value {
    let mut value = empty();
    value.as_object_mut().unwrap().remove("baseCommit");
    value["comparisonUrl"] = Value::Null;
    value["changesStatus"] = json!(status);
    value
}

pub(super) fn load(bytes: Vec<u8>) -> LoadedIndex {
    let key = BlobKey {
        hash: BlobHash::digest(&bytes),
        incarnation: Uuid::from_u128(1),
    };
    let reader = BoundedStoredIndexReader::new(Arc::new(Unimock::new(
        FileStoreMock::get
            .some_call(matching!(_))
            .returns(Ok(Some(bytes))),
    )));
    reader.load(&key).unwrap().unwrap()
}

pub(super) fn screens() -> CatalogueIndex {
    let mut value = empty();
    let mut kept = record("a-kept", "Kept screen", "unmodified");
    kept["changes"]["included"] = json!(false);
    kept["views"] = json!([
        { "viewport": "mobile", "colorScheme": "light" },
        { "viewport": "desktop", "colorScheme": "light" }
    ]);
    let mut mixed = record("mixed", "Mixed views", "changed");
    mixed["views"] = json!([
        { "viewport": "desktop", "colorScheme": "dark" },
        { "viewport": "desktop", "colorScheme": "light" }
    ]);
    let mut new = record("z-new", "New screen", "added");
    new["views"] = json!([{ "viewport": "mobile", "colorScheme": "light" }]);
    value["screens"] = json!([new, mixed, kept]);
    value["components"] = json!([record("component/variant", "Variant", "changed")]);
    value["useCases"] = json!([record("journey", "Journey", "changed")]);
    value["removedEntries"] = json!([{ "entry": record("removed", "Removed screen", "removed") }]);
    parse(&value)
}
