//! Authored schemas and source diagnostics survive transport decoding.

use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::error::ModelError;
use mokly_model::validation::PropValidator;
use serde_json::json;

use crate::definitions::{Definition, Definitions};
use crate::diagnostics::DefinitionCode;
use crate::error::{Error, RemoteCode};
use crate::methods::{Call, Generation};
use crate::typescript::generate;
use crate::wire::{MethodResult, Request, Response};

#[test]
fn schema_mistakes_reach_the_single_rust_profile_validator() {
    for keyword in ["default", "pattern", "$ref"] {
        let mut schema = json!({"type":"object","additionalProperties":false});
        schema[keyword] = json!("unsupported");
        let response: Response = serde_json::from_value(json!({"id":1,"result":{"screens":[],"pages":[],"useCases":[],"folders":[],"components":[{"handle":"ui/button.tsx#Button","propSchema":schema}],"warnings":[],"stories":[],"diagnostics":[]}})).unwrap();
        let request = Request {
            id: 1,
            call: Call::Describe(Generation {
                generation: "g".into(),
            }),
        };
        let MethodResult::Definitions(definitions) = response.decode_result(&request).unwrap()
        else {
            panic!()
        };
        let definition = &definitions.components[0];
        let context = Context {
            entry: definition.handle.clone(),
            variant: None,
            kind: AuthoringKind::JavaScript,
        };
        let ModelError::Schema(diagnostic) =
            PropValidator::compile(definition.prop_schema.as_ref().unwrap(), &context)
                .err()
                .unwrap()
        else {
            panic!()
        };
        assert_eq!(diagnostic.code.as_str(), "component-schema");
        assert_eq!(diagnostic.entry, "ui/button.tsx#Button");
        assert_eq!(diagnostic.path, format!("/{keyword}"));
    }
}

#[test]
fn describe_diagnostics_and_error_replies_keep_the_authoring_code() {
    let definitions: Definitions = serde_json::from_value(json!({"screens":[],"pages":[],"useCases":[],"folders":[],"components":[],"warnings":[],"stories":[],"diagnostics":[{"code":"array-export","module":"specs/a.tsx","exportName":"default","message":"export default is an array; export one definition per export"}]})).unwrap();
    assert!(matches!(
        definitions.diagnostics[0].code,
        DefinitionCode::ArrayExport
    ));
    assert_eq!(
        definitions.diagnostics[0].export_name.as_deref(),
        Some("default")
    );
    for code in ["array-export", "empty-module", "invalid-definition"] {
        let response: Response = serde_json::from_value(
            json!({"id":1,"error":{"code":code,"message":"module diagnostic"}}),
        )
        .unwrap();
        assert!(matches!(
            response.decode_result(&Request {
                id: 1,
                call: Call::Describe(Generation {
                    generation: "g".into()
                })
            }),
            Err(Error::Remote {
                code: RemoteCode::Definition(_),
                ..
            })
        ));
    }
}

#[test]
fn generated_sidecar_modules_include_wire_dependencies_and_number_ids() {
    let files = generate();
    assert!(files["Request.ts"].contains("id: number"));
    for name in [
        "Call.ts",
        "Frame.ts",
        "Definitions.ts",
        "DefinitionDiagnostic.ts",
        "Control.ts",
        "JsonValue.ts",
    ] {
        assert!(files.contains_key(name), "missing {name}");
    }
    assert!(files.values().all(|file| file.lines().count() <= 300));
    assert!(!files.values().any(|file| file.contains("bigint")));
}

#[test]
fn an_explicit_null_schema_stays_distinct_from_an_absent_schema() {
    for value in [json!(null), json!(false), json!(1), json!("object")] {
        let definition: Definition =
            serde_json::from_value(json!({"handle":"screen.tsx#Screen","propSchema":value}))
                .unwrap();
        assert_eq!(definition.prop_schema.as_ref(), Some(&value));
        let context = Context {
            entry: definition.handle.clone(),
            variant: None,
            kind: AuthoringKind::JavaScript,
        };
        assert!(matches!(
            PropValidator::compile(definition.prop_schema.as_ref().unwrap(), &context),
            Err(ModelError::Schema(_))
        ));
    }
    let definition: Definition =
        serde_json::from_value(json!({"handle":"screen.tsx#Screen"})).unwrap();
    assert!(definition.prop_schema.is_none());
}
