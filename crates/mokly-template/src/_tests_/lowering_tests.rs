//! Authored HTML source and HTML output after lowering template expressions.

use mokly_model::data::Props;
use mokly_model::prop_schema::PropSchema;
use serde_json::{from_value, json};

use crate::engine::Engine;
use crate::error::TemplateError;
use crate::rendered::SpanKind;

#[test]
fn blanks_only_delimiters_and_template_code_and_keeps_raw_bytes_and_line_endings() {
    let mut engine = Engine::new();
    let source =
        "α\t\n{{- '}}🦀' -}}{# éx\r\n#}{% raw -%}\t{{name}}\n{%- endraw %}{% set x = 3 %}\r<z>";
    let analysis = engine
        .compile("body", source, &PropSchema::default())
        .unwrap();
    assert_eq!(
        analysis.blanked_source,
        concat!(
            "α\t\n",
            "                ",
            "      \r\n  ",
            "          ",
            "\t{{name}}\n",
            "             ",
            "               ",
            "\r<z>"
        )
    );
    assert_eq!(analysis.blanked_source.len(), source.len());
}

#[test]
fn reads_declared_hyphenated_names_and_preserves_regular_subtraction() {
    let schema: PropSchema = from_value(json!({ "properties": {
        "a-b": {"properties": {"c-d": {}}}, "end-": {}
    }}))
    .unwrap();
    let props: Props =
        from_value(json!({ "a-b": {"c-d": "yes", "c": 9}, "end-": "end", "a": 7, "b": 3, "d": 1 }))
            .unwrap();
    let mut engine = Engine::new();
    engine
        .compile(
            "body",
            "{{a-b.c-d}}|{{a-b.c}}|{{end-}}|{{a-d}}|{{ a - b }}",
            &schema,
        )
        .unwrap();
    assert_eq!(engine.render("body", &props).unwrap().text, "yes|9|end|6|4");
}

#[test]
fn writes_or_omits_whole_attributes_and_keeps_other_template_forms() {
    let source = concat!(
        "<ui-item Checked='{{ on }}' disabled={{ off }} empty=\"{{ none }}\" missing='{{ absent }}' ",
        "title='{{ name }}' data-value={{ 3 / 2 }} data-list='{{ [on, off][0] }}' ",
        "class='on-{{ off }}' note='{{- \"}}\" -}}' with=\"{{ on }} {{ off }}\" row=\"$name\" mokly-if=\"$on\">"
    );
    let schema = from_value(json!({"properties": {"absent": {}}})).unwrap();
    let props = from_value(json!({"on": true, "off": false, "name": "A & \"B\""})).unwrap();
    let mut engine = Engine::new();
    engine.compile("body", source, &schema).unwrap();
    let output = engine.render("body", &props).unwrap();
    assert_eq!(
        output.text,
        concat!(
            "<ui-item Checked=\"\"    title=\"A &amp; &quot;B&quot;\" data-value=\"1.5\" data-list=\"\" ",
            "class='on-false' note=\"}}\" with=\"true false\" row=\"$name\" mokly-if=\"$on\">"
        )
    );
}

#[test]
fn lowers_each_branch_attribute_but_does_not_treat_text_modes_as_tags() {
    let source = concat!(
        "<!-- <i x='{{ yes }}'> -->",
        "<textarea><i x='{{ yes }}'></textarea>",
        "<style>.x { content: \"<i x='{{ yes }}'>\" }</style>",
        "<noscript><i x='{{ yes }}'></i></noscript>",
        "<i {% if yes %} x='{{ yes }}'{% else %} x='{{ no }}'{% endif %}>"
    );
    let mut engine = Engine::new();
    engine
        .compile("body", source, &PropSchema::default())
        .unwrap();
    let props = from_value(json!({"yes": true})).unwrap();
    assert_eq!(
        engine.render("body", &props).unwrap().text,
        concat!(
            "<!-- <i x='true'> -->",
            "<textarea><i x='true'></textarea>",
            "<style>.x { content: \"<i x='true'>\" }</style>",
            "<noscript><i x=\"\"></i></noscript>",
            "<i  x=\"\">"
        )
    );
    let props = from_value(json!({"yes": false, "no": false})).unwrap();
    assert!(
        engine
            .render("body", &props)
            .unwrap()
            .text
            .ends_with("<i  >")
    );
}

#[test]
fn writes_or_omits_whole_values_on_dynamic_names_in_authored_tags() {
    let source = "<{{ element }} data-{{ dash-name }}='{{ enabled }}' {{ label }}={{ text if enabled }}></{{ element }}>";
    let schema = from_value(json!({"properties": {"dash-name": {}}})).unwrap();
    let mut engine = Engine::new();
    let analysis = engine.compile("body", source, &schema).unwrap();
    let reads: Vec<_> = analysis
        .free_names
        .iter()
        .map(|name| name.path[0].as_str())
        .collect();
    assert_eq!(
        reads,
        [
            "element",
            "dash-name",
            "enabled",
            "label",
            "text",
            "enabled",
            "element"
        ]
    );

    let mut props: Props = from_value(json!({
        "element": "div", "dash-name": "state", "label": "title", "enabled": true, "text": "A & B"
    }))
    .unwrap();
    let rendered = engine.render("body", &props).unwrap();
    assert_eq!(
        rendered.text,
        "<div data-state=\"\" title=\"A &amp; B\"></div>"
    );
    assert_eq!(rendered.source_offset(5), source.find("data-"));
    props.insert("enabled".into(), from_value(json!(false)).unwrap());
    assert_eq!(engine.render("body", &props).unwrap().text, "<div  ></div>");
}

#[test]
fn maps_rendered_attributes_macro_calls_and_loop_html_to_the_authored_bytes() {
    let source = concat!(
        "{% macro label() %}<b>X</b>{% endmacro %}",
        "<div title='{{dash-name}}'>{{ label() }}",
        "{% for word in words %}<i>{{ word }}</i>{% endfor %}</div>"
    );
    let schema = from_value(json!({"properties": {"dash-name": {}, "words": {}}})).unwrap();
    let props = from_value(json!({"dash-name": "A & B", "words": ["a", "b"]})).unwrap();
    let mut engine = Engine::new();
    engine.compile("body", source, &schema).unwrap();
    let rendered = engine.render("body", &props).unwrap();
    assert_eq!(
        rendered.text,
        "<div title=\"A &amp; B\"><b>X</b><i>a</i><i>b</i></div>"
    );
    let spans: Vec<_> = rendered
        .spans
        .iter()
        .filter(|span| span.kind == SpanKind::Expression)
        .map(|span| {
            (
                &rendered.text[span.output.clone()],
                &source[span.source.clone()],
            )
        })
        .collect();
    assert_eq!(
        spans,
        [
            ("title=\"A &amp; B\"", "title='{{dash-name}}'"),
            ("<b>X</b>", "label()"),
            ("a", "word"),
            ("b", "word"),
        ]
    );
    for (output, _) in rendered.text.match_indices("<i>") {
        assert_eq!(
            rendered.source_offset(output + 1),
            source.find("<i>").map(|offset| offset + 1)
        );
    }
    assert_eq!(rendered.source_offset(rendered.text.len()), None);
}

#[test]
fn locates_syntax_and_render_errors_at_authored_openers_after_rewrites() {
    let schema = from_value(json!({"properties": {"data-name": {}}})).unwrap();
    let props = from_value(json!({"data-name": "example"})).unwrap();
    let mut engine = Engine::new();
    let source = "<i name='{{data-name}}'>\n{{ no_such_value }}";
    engine.compile("body", source, &schema).unwrap();
    let error = engine.render("body", &props).unwrap_err();
    assert_eq!(error.offset(), Some(25));
    let source = "<i name='{{data-name}}'>\n{% unknown %}";
    let error = engine.compile("bad", source, &schema).unwrap_err();
    assert_eq!(error.offset(), Some(25));
    assert!(matches!(error, TemplateError::Syntax { .. }));

    for tag in ["{% raw %}", "{# comment"] {
        let source = format!("ok {{# closed #}}{tag}");
        let error = engine.compile("bad", &source, &schema).unwrap_err();
        assert_eq!(error.offset(), Some(15), "{source}");
        assert!(matches!(error, TemplateError::Syntax { .. }));
    }
}
