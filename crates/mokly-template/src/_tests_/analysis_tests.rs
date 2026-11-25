//! Compile-time analysis and authored source coordinates.

use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use serde_json::{from_value, json};

use crate::engine::Engine;
use crate::error::{ForbiddenKind, TemplateError};

#[test]
fn reports_forbidden_constructs_in_all_branches_with_their_source_ranges() {
    let source = concat!(
        "{% if false %}{% include 'one' %}{% import 'two' as x %}{% from 'two' import m %}",
        "{% extends 'three' %}{% block x %}{% endblock %}{% autoescape false %}{% endautoescape %}",
        "{{ value | safe }}{% filter safe %}value{% endfilter %}{{ value is not safe }}",
        "{% endif %}{# {{ value | safe }} #}{% raw %}{% include 'ignored' %}{% endraw %}"
    );
    let mut engine = Engine::new();
    let error = engine
        .compile("body", source, &PropSchema::default())
        .unwrap_err();
    let TemplateError::Forbidden { constructs, .. } = error else {
        panic!("expected forbidden constructs, got {error}");
    };
    let found: Vec<_> = constructs
        .iter()
        .map(|item| (item.kind, &source[item.source.clone()]))
        .collect();
    assert_eq!(
        found,
        [
            (ForbiddenKind::Include, "{% include 'one' %}"),
            (ForbiddenKind::Import, "{% import 'two' as x %}"),
            (ForbiddenKind::From, "{% from 'two' import m %}"),
            (ForbiddenKind::Extends, "{% extends 'three' %}"),
            (ForbiddenKind::Block, "{% block x %}"),
            (ForbiddenKind::AutoEscape, "{% autoescape false %}"),
            (ForbiddenKind::Safe, "safe"),
            (ForbiddenKind::Safe, "safe"),
            (ForbiddenKind::Safe, "safe"),
        ]
    );
    engine
        .compile(
            "registry",
            "{{ 'safe' is filter }}|{{ 'safe' is test }}|{{ {'safe': 'name'}.safe }}",
            &PropSchema::default(),
        )
        .unwrap();
    assert_eq!(
        engine.render("registry", &Props::new()).unwrap().text,
        "false|false|name"
    );
}

#[test]
fn finds_free_reads_in_expressions_and_excludes_names_bound_in_each_scope() {
    let source = concat!(
        "{% set value = value %}",
        "{% set capture | replace(old, new) %}{{ body }}{% endset %}",
        "{% with x = user.name, y = x %}{{ y }}{% endwith %}",
        "{% for key, row in rows | items if row.done %}{{ loop.index }}{{ row.name }}{{ key }}",
        "{% else %}{{ empty }}{% endfor %}",
        "{% if flag %}{% set label = left %}{% else %}{% set label = right %}{% endif %}{{ label }}",
        "{% macro wrap(p=fallback) %}<i>{{ p }}{{ value }}{{ caller() }}</i>{% endmacro %}",
        "{% call(arg) wrap(name) %}{{ arg }}{{ hidden }}{% endcall %}",
        "{{ range(3) | length + rows[index].count }}{{ user['name'] }}"
    );
    let schema: PropSchema = from_value(json!({
        "properties": {"user": {"properties": {"name": {}}}, "value": {}, "rows": {}, "other": {}}
    }))
    .unwrap();
    let mut engine = Engine::new();
    assert!(engine.has_global("range"));
    assert!(!engine.has_global("name"));
    let analysis = engine.compile("body", source, &schema).unwrap();
    let paths: Vec<_> = analysis
        .free_names
        .iter()
        .map(|name| name.path.join("."))
        .collect();
    assert_eq!(
        paths,
        [
            "value",
            "old",
            "new",
            "body",
            "user.name",
            "rows",
            "empty",
            "flag",
            "left",
            "right",
            "fallback",
            "name",
            "hidden",
            "range",
            "rows",
            "index",
            "user.name"
        ]
    );
    assert_eq!(
        analysis
            .read_props
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["rows", "user", "value"]
    );
    assert!(analysis.free_names[4].schema_at(&schema).is_some());
    assert!(analysis.free_names[12].schema_at(&schema).is_none());
}

#[test]
fn gives_each_free_read_its_own_byte_range_after_lowering() {
    let source = "🙂\r\n<i x='{{ dash-name.nested.key }}' y='{{ value }}'>{{ value }}</i>";
    let schema: PropSchema = from_value(json!({
        "properties": {"dash-name": {"properties": {"nested": {"properties": {"key": {}}}}}}
    }))
    .unwrap();
    let mut engine = Engine::new();
    let analysis = engine.compile("body", source, &schema).unwrap();
    let positions: Vec<_> = analysis
        .free_names
        .iter()
        .map(|name| {
            let prefix = &source[..name.source.start];
            (
                name.path.join("."),
                &source[name.source.clone()],
                prefix.bytes().filter(|byte| *byte == b'\n').count() + 1,
                prefix.rsplit('\n').next().unwrap().chars().count() + 1,
            )
        })
        .collect();
    assert_eq!(
        positions,
        [
            ("dash-name.nested.key".into(), "dash-name.nested.key", 2, 10),
            ("value".into(), "value", 2, 41),
            ("value".into(), "value", 2, 54),
        ]
    );
}
