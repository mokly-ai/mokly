//! Rendering with props, escaping, and evaluation limits.

use std::thread;

use minijinja::ErrorKind;
use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use serde_json::{Value, from_value, json};

use crate::engine::Engine;
use crate::error::TemplateError;
use crate::rendered::RenderedBody;

fn render(source: &str, schema: Value, props: Value) -> Result<RenderedBody, TemplateError> {
    let mut engine = Engine::new();
    engine.compile("body", source, &from_value(schema).unwrap())?;
    engine.render("body", &from_value(props).unwrap())
}

#[test]
fn escapes_prop_text_and_preserves_markup_from_a_local_macro() {
    let source = "{% macro label(value) %}<b>{{ value }}</b>{% endmacro %}{{ label(name) }}";
    let rendered = render(source, json!({}), json!({"name": "A & < B"})).unwrap();
    assert_eq!(rendered.text, "<b>A &amp; &lt; B</b>");
}

#[test]
fn fills_nested_optional_props_but_keeps_null_and_required_props_distinct() {
    let schema = json!({
        "properties": {
            "missing": { "properties": { "part": {} } },
            "nested": { "properties": { "part": {}, "needed": {} }, "required": ["needed"] },
            "rows": { "items": { "properties": { "part": {} } } },
            "nullable": {}
        }
    });
    let props = json!({"nested": {}, "rows": [{}], "nullable": null});
    let source = concat!(
        "[{{ missing.part }},{{ missing['part'][0] }},{{ nested.part }},{{ nullable }}]",
        "{% if missing %}present{% else %}absent{% endif %}|",
        "{% for item in missing %}{{ item }}{% else %}empty{% endfor %}|",
        "{{ missing is defined }}|{{ nested.part is undefined }}|{{ missing | default('fallback') }}|",
        "{{ rows[0].part | d('fallback') }}|{{ nullable is defined }}|",
        "{{ false | default('fallback') }}|{{ false | default('fallback', true) }}|",
        "{{ nested.needed is defined }}"
    );
    let rendered = render(source, schema.clone(), props.clone()).unwrap();
    assert_eq!(
        rendered.text,
        "[,,,]absent|empty|false|true|fallback|fallback|true|false|fallback|false"
    );
    let error = render("{{ nested.needed }}", schema, props).unwrap_err();
    assert!(
        matches!(error, TemplateError::Render { source, .. } if source.kind() == ErrorKind::UndefinedError)
    );
}

#[test]
fn semi_strict_rejects_printing_iterating_and_reading_undeclared_values() {
    for source in [
        "x {{ absent }}",
        "x {{ absent.name }}",
        "x {% for x in absent %}{% endfor %}",
    ] {
        let error = render(source, json!({}), json!({})).unwrap_err();
        assert_eq!(error.offset(), Some(2), "{source}");
        assert!(
            matches!(error, TemplateError::Render { source, .. } if source.kind() == ErrorKind::UndefinedError)
        );
    }
    let rendered = render(
        "{% if absent %}present{% else %}undefined{% endif %}",
        json!({}),
        json!({}),
    )
    .unwrap();
    assert_eq!(rendered.text, "undefined");
}

#[test]
fn direct_prints_of_arrays_and_maps_fail_with_props_errors() {
    for source in ["hi {{ data }}", "hi <i data-v='{{ data }}'>"] {
        for data in [json!([1]), json!({"a": 1})] {
            let error = render(source, json!({}), json!({"data": data})).unwrap_err();
            assert_eq!(error.offset(), source.find("{{"), "{source}");
            assert!(matches!(error, TemplateError::Props { .. }), "{error}");
        }
    }
}

#[test]
fn formats_numbers_with_mokly_spelling_and_pluralizes_numeric_one() {
    let props: Props =
        serde_json::from_str(r#"{"zero":-0.0,"decimal":0.000001,"big":1e21}"#).unwrap();
    let source = concat!(
        "{{ zero }}|{{ decimal }}|{{ big }}|{{ 3 / 2 }}|",
        "{{ 1 | plural('task', 'tasks') }}|{{ 1.0 | plural('task', 'tasks') }}|",
        "{{ 0 | plural('task', 'tasks') }}|{{ true | plural('task', 'tasks') }}"
    );
    let mut engine = Engine::new();
    engine
        .compile("numbers", source, &PropSchema::default())
        .unwrap();
    let rendered = engine.render("numbers", &props).unwrap();
    assert_eq!(rendered.text, "0|0.000001|1e+21|1.5|task|task|tasks|tasks");
}

#[test]
fn iterates_sorted_maps_and_supports_loop_controls_and_adjacent_items() {
    let source = concat!(
        "{% for key in data %}{{ key }}{% endfor %}|",
        "{% for key in {'z': 3, 'b': 2, 'a': 1} %}{{ key }}{% endfor %}|",
        "{% for n in range(4) %}{% if n == 1 %}{% continue %}{% endif %}",
        "{% if n == 3 %}{% break %}{% endif %}{{ loop.nextitem }}{% endfor %}"
    );
    let rendered = render(source, json!({}), json!({"data": {"z": 3, "b": 2, "a": 1}})).unwrap();
    assert_eq!(rendered.text, "abz|abz|13");
}

#[test]
fn fuel_stops_long_loops_and_a_later_render_gets_a_fresh_budget() {
    let mut engine = Engine::new();
    let source = "{% for i in range(count) %}{% for j in range(count) %}x{% endfor %}{% endfor %}";
    engine
        .compile("loops", source, &PropSchema::default())
        .unwrap();
    let long = from_value(json!({"count": 10000})).unwrap();
    let short = from_value(json!({"count": 2})).unwrap();
    assert!(matches!(
        engine.render("loops", &long),
        Err(TemplateError::Fuel { .. })
    ));
    assert_eq!(engine.render("loops", &short).unwrap().text, "xxxx");
}

#[test]
fn macro_recursion_reaches_the_limit_on_a_two_mib_stack() {
    thread::Builder::new()
        .stack_size(2 * 1024 * 1024)
        .spawn(|| {
            let mut engine = Engine::new();
            let source = concat!(
                "{% macro recurse(n) %}",
                "{% if n > 1 %}{{ recurse(n - 1) }}{% else %}done{% endif %}",
                "{% endmacro %}{{ recurse(depth) }}"
            );
            engine.compile("recursive", source, &PropSchema::default()).unwrap();
            let depth = from_value(json!({"depth": 21})).unwrap();
            let next_depth = from_value(json!({"depth": 22})).unwrap();
            assert_eq!(engine.render("recursive", &depth).unwrap().text, "done");
            let error = engine.render("recursive", &next_depth).unwrap_err();
            assert!(matches!(error, TemplateError::Render { source, .. } if source.kind() == ErrorKind::InvalidOperation));
        })
        .unwrap()
        .join()
        .unwrap();
}

#[test]
fn keeps_named_bodies_available_after_a_failed_recompile() {
    let mut engine = Engine::new();
    let schema = PropSchema::default();
    engine.compile("one", "First", &schema).unwrap();
    engine.compile("two", "Second", &schema).unwrap();
    assert!(matches!(
        engine.compile("one", "Bad {{", &schema),
        Err(TemplateError::Syntax {
            offset: Some(4),
            ..
        })
    ));
    assert_eq!(engine.render("one", &Props::new()).unwrap().text, "First");
    assert_eq!(engine.render("two", &Props::new()).unwrap().text, "Second");
}
