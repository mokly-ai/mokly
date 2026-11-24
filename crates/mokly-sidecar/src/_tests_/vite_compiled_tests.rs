//! Vite fetch records survive the Rust recipe transport without loss.

use serde_json::json;

use crate::compiled::CompiledGeneration;
use crate::compiled_fixture::compiled;

#[test]
fn vite_recipe_round_trip_keeps_transformed_and_external_fetches() {
    let mut value = serde_json::to_value(compiled("identity")).unwrap();
    let vite = json!({"version":"8.3.8", "entry":"virtual:mokly-entry", "modules":[
        {"url":"virtual:mokly-entry", "importer":null, "result":{
            "code":"export {}", "file":null, "id":"\u{0}entry",
            "url":"virtual:mokly-entry", "invalidate":true}},
        {"url":"react", "importer":"\u{0}entry", "result":{
            "externalize":"file:///repo/node_modules/react/index.js", "type":"commonjs"}}
    ]});
    value["vite"] = vite.clone();
    let restored: CompiledGeneration = serde_json::from_value(value).unwrap();
    assert_eq!(serde_json::to_value(restored).unwrap()["vite"], vite);
}
