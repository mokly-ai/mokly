//! Every declared component rule is checked in Rust before rendering.

use std::fs;

use mokly_catalogue::diagnostic::Code;
use mokly_catalogue::error::CatalogueError;

use super::support::Consumer;

#[test]
fn component_declarations_keep_typed_schema_prop_slot_control_and_element_errors() {
    let schema = "propSchema: {type:'object',additionalProperties:false,properties:{label:{type:'string'}}},";
    for (fields, code) in [
        ("", Code::ComponentSchema),
        (
            "propSchema: {type:'object',properties:{}},",
            Code::ComponentSchema,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,required:['label'],properties:{label:{type:'string'}}},",
            Code::ComponentProps,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{key:{type:'string'}}},",
            Code::ComponentSlots,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{__moklySource:{type:'string'}}},",
            Code::ComponentSlots,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{to:{type:'string'}}},element:'extra-chip',",
            Code::ComponentElement,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{}},element:'mokly-private',",
            Code::ComponentElement,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{}},slots:['children','children'],",
            Code::ComponentSlots,
        ),
        (
            "propSchema: {type:'object',additionalProperties:false,properties:{}},controls:{missing:{kind:'text'}},",
            Code::ComponentControls,
        ),
    ] {
        let consumer = Consumer::new();
        fs::write(consumer.root().join("specs/extra.mockup.ts"), format!("import {{defineComponent}} from '@mokly/mokly'; export default defineComponent({{title:'Extra',description:'',relatedDocs:[],render:()=>null,{fields}}});")).unwrap();
        let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
            panic!("expected {code:?}")
        };
        assert!(issues.iter().any(|issue| issue.code == code), "{issues:?}");
    }
    let consumer = Consumer::new();
    fs::write(consumer.root().join("specs/extra.mockup.ts"), format!("import {{defineComponent}} from '@mokly/mokly'; export default defineComponent({{title:'Extra',description:'',relatedDocs:[],render:()=>null,{schema} props:{{label:'Saved'}},slots:['label'] }});")).unwrap();
    let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
        panic!("slots")
    };
    assert!(
        issues
            .iter()
            .any(|issue| issue.code == Code::ComponentSlots)
    );
}
