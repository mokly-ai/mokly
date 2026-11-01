//! Repeated instances share one compiled schema in each publication.

use super::UsageSchemas;
use crate::{readers, wire_decode};

#[test]
fn one_schema_compilation_serves_all_instances_and_invalid_props_still_fail() {
    let index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v9.json"
    ))
    .unwrap();
    let component = &index.components[0];
    let props = wire_decode::decode(&component.visual.props).unwrap();
    for instances in [8, 32] {
        let mut schemas = UsageSchemas::new(&index.components);
        assert_eq!(schemas.compilations, 0);
        for _ in 0..instances {
            schemas.validate(&component.entry.path, &props).unwrap();
        }
        assert_eq!(schemas.compilations, 1);
        let invalid = serde_json::from_value(serde_json::json!({"label":42})).unwrap();
        assert!(schemas.validate(&component.entry.path, &invalid).is_err());
        assert_eq!(schemas.compilations, 1);
    }
}
