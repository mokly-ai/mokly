//! Large integer mappings and transitive module generation.

use ts_rs::TS;

use crate::type_modules::TypeModules;

#[derive(TS)]
#[expect(dead_code, reason = "type-only code generation fixture")]
struct LargeFields {
    signed: i64,
    unsigned: u64,
    wide: i128,
}

#[derive(TS)]
#[expect(dead_code, reason = "type-only code generation fixture")]
struct Container {
    values: Vec<LargeFields>,
}

#[test]
fn json_integer_fields_use_numbers_and_dependencies_have_their_own_file() {
    let mut generator = TypeModules::default();
    generator.add::<Container>();
    let modules = generator.finish();
    assert_eq!(modules.len(), 2);
    assert!(modules["Container.ts"].contains("import type { LargeFields }"));
    assert!(modules["LargeFields.ts"].contains("signed: number"));
    assert!(modules["LargeFields.ts"].contains("unsigned: number"));
    assert!(modules["LargeFields.ts"].contains("wide: number"));
    assert!(!modules.values().any(|text| text.contains("bigint")));
}
