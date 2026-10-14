//! Typed round trips for the complete method inventory.

use serde_json::{Value, json};

use crate::methods::Call;
use crate::wire::{MethodResult, Request, Response};

#[test]
fn every_method_and_result_round_trips() {
    let render = json!({"generation":"g","handle":"specs/button.tsx#Button","props":{"label":"Save"},"viewport":"mobile","colorScheme":"light"});
    let mut component = render.clone();
    component["slots"] = json!({"children":"token"});
    component["ignoreScope"] = json!("enabled");
    let mut story = render.clone();
    story.as_object_mut().unwrap().remove("handle");
    story["storyId"] = json!("specs/button.stories.tsx#Primary");
    let fragment = json!({"html":"<button>Save</button>","styles":[],"resources":[],"warnings":[]});
    for (method, params, result) in [
        ("hello", json!({}), json!({"version":"0.14.0"})),
        (
            "bundle",
            json!({"entryFiles":[],"renderer":null,"storiesFiles":[],"moduleResolution":{},"sourceRoot":"/checkout"}),
            json!({"generation":"g","modules":[{"path":"specs/a.tsx","imports":["ui/button.tsx"]}],"warnings":[]}),
        ),
        (
            "describe",
            json!({"generation":"g"}),
            json!({"screens":[],"pages":[],"useCases":[],"folders":[],"components":[],"stories":[]}),
        ),
        ("renderScreen", render, fragment.clone()),
        ("renderComponent", component, fragment.clone()),
        ("renderStory", story, fragment),
        (
            "renderPage",
            json!({"generation":"g","handle":"specs/page.ts#Page"}),
            json!({"html":"<!doctype html><html></html>","resources":[],"warnings":[]}),
        ),
        (
            "processCss",
            json!({"postcss":"postcss.cjs","sourcePath":"ui/a.css","text":""}),
            json!({"text":"","dependencies":[{"kind":"directory","path":"ui"}]}),
        ),
        (
            "cssModules",
            json!({"generation":"g","classMaps":{"ui/a.module.css":{"button":"button-hash"}}}),
            Value::Null,
        ),
        ("dispose", json!({"generation":"g"}), Value::Null),
        ("shutdown", json!({}), Value::Null),
    ] {
        let value = json!({"id":12,"method":method,"params":params});
        let request: Request = serde_json::from_value(value).unwrap();
        let encoded = serde_json::to_value(&request).unwrap();
        assert_eq!(encoded["method"], method);
        let _: Call =
            serde_json::from_value(json!({"method":method,"params":encoded["params"]})).unwrap();
        let response: Response = serde_json::from_value(json!({"id":12,"result":result})).unwrap();
        response.decode_result(&request).unwrap();
    }
}

#[test]
fn authoring_metadata_is_preserved_until_catalogue_validation() {
    let result = json!({"screens":[],"pages":[],"useCases":[],"folders":[],"components":[{"handle":"ui/button.tsx#Button","controls":{"tone":{"kind":"select","options":[]}},"movedFrom":"old/button","variants":[],"props":{},"slots":[],"tags":[]}],"stories":[]});
    let request: Request =
        serde_json::from_value(json!({"id":1,"method":"describe","params":{"generation":"g"}}))
            .unwrap();
    let response: Response = serde_json::from_value(json!({"id":1,"result":result})).unwrap();
    let MethodResult::Definitions(definitions) = response.decode_result(&request).unwrap() else {
        panic!()
    };
    assert_eq!(
        definitions.components[0].metadata["movedFrom"],
        "old/button"
    );
    assert!(definitions.components[0].metadata["controls"].is_object());
}
