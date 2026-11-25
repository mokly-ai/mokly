//! Lower the existing prop and whole-attribute forms to MiniJinja source.

use std::ops::Range;
use std::sync::Arc;

use minijinja::machinery::parse_expr;
use mokly_model::prop_schema::PropSchema;

use crate::error::TemplateError;
use crate::html_attributes::{Attribute, whole_values};
use crate::lexer::{Lexed, Tag};
use crate::source_map::{SourceMap, SourceWriter};

pub(crate) struct Lowered {
    pub(crate) text: String,
    pub(crate) map: SourceMap,
    pub(crate) private_name: Option<Arc<str>>,
}

pub(crate) fn lower(
    source: &str,
    lexed: &Lexed<'_>,
    schema: &PropSchema,
) -> Result<Lowered, TemplateError> {
    let private = lexed.private_name("__mokly");
    let capture = lexed.private_name("__mokly_attribute_name");
    let attributes = whole_values(source, lexed);
    let mut attributes = attributes.iter().peekable();
    let mut writer = SourceWriter::new(source);
    let mut cursor = 0;
    let mut capturing = false;
    for tag in &lexed.tags {
        if let Some(attr) = attributes.peek()
            && attr.dynamic_name
            && !capturing
            && (attr.source.start..name_end(attr)).contains(&tag.source.start)
        {
            writer.copy(cursor..attr.source.start);
            let open = format!("{{% with {capture} = none %}}{{% set {capture} %}}");
            writer.replace(&open, attr.source.start..attr.source.start);
            cursor = attr.source.start;
            capturing = true;
        }
        let dashed = (!tag.statement)
            .then(|| dashed_path(source, tag, schema, &private))
            .flatten();
        if let Some(attribute) = attributes.next_if(|attr| attr.open_expression == tag.source.start)
        {
            let start = if capturing {
                name_end(attribute)
            } else {
                attribute.source.start
            };
            writer.copy(cursor..start);
            write_attribute(
                &mut writer,
                source,
                attribute,
                tag,
                dashed,
                &private,
                capturing.then_some(&capture),
            )?;
            writer.tag(
                start..attribute.source.end,
                tag.source.start,
                attribute.source.start,
            );
            cursor = attribute.source.end;
            capturing = false;
        } else {
            writer.tag(tag.source.clone(), tag.source.start, tag.source.start);
            if let Some((path, range)) = dashed {
                writer.copy(cursor..range.start);
                writer.replace(&path, range.clone());
                cursor = range.end;
            }
        }
    }
    writer.copy(cursor..source.len());
    let (text, map) = writer.finish();
    Ok(Lowered {
        text,
        map,
        private_name: (cursor != 0).then(|| Arc::from(private)),
    })
}

fn name_end(attr: &Attribute<'_>) -> usize {
    attr.source.start + attr.name.len()
}

fn write_attribute(
    writer: &mut SourceWriter<'_>,
    source: &str,
    attr: &Attribute<'_>,
    tag: &Tag,
    dashed: Option<(String, Range<usize>)>,
    private: &str,
    capture: Option<&str>,
) -> Result<(), TemplateError> {
    if dashed.is_none()
        && let Err(error) = parse_expr(&source[tag.content.clone()])
    {
        return Err(TemplateError::Syntax {
            offset: Some(tag.source.start),
            source: error,
        });
    }
    let (start, call) = if let Some(capture) = capture {
        (
            name_end(attr),
            format!("{{% endset %}}{{{{ {private}.attribute({capture}, ("),
        )
    } else {
        let name = attr.name.replace('\\', "\\\\").replace('"', "\\\"");
        (
            attr.source.start,
            format!("{{{{ {private}.attribute(\"{name}\", ("),
        )
    };
    writer.replace(&call, start..tag.content.start);
    let end = if let Some((path, range)) = dashed {
        writer.copy(tag.content.start..range.start);
        writer.replace(&path, range.clone());
        writer.copy(range.end..tag.content.end.max(range.end));
        tag.content.end.max(range.end)
    } else {
        writer.copy(tag.content.clone());
        tag.content.end
    };
    let trim = attr.unquoted && source[end..tag.source.end].starts_with('-');
    let close = match (capture.is_some(), trim) {
        (true, true) => ")) }}{% endwith -%}",
        (true, false) => ")) }}{% endwith %}",
        (false, true) => ")) -}}",
        (false, false) => ")) }}",
    };
    writer.replace(close, end..attr.source.end);
    Ok(())
}

fn dashed_path(
    source: &str,
    tag: &Tag,
    schema: &PropSchema,
    private: &str,
) -> Option<(String, Range<usize>)> {
    // A declared name ending in a hyphen can look like a whitespace-control marker.
    let end = tag.source.end - 2;
    let mut range = tag.content.start..end;
    if !dashed_prop(&source[range.clone()], schema) {
        range = tag.content.clone();
        if !dashed_prop(&source[range.clone()], schema) {
            return None;
        }
    }
    let text = &source[range.clone()];
    let path = text.trim_ascii();
    let start = range.start + text.len() - text.trim_ascii_start().len();
    let mut expression = format!("{private}.props");
    for part in path.split('.') {
        expression.push_str("[\"");
        expression.push_str(part);
        expression.push_str("\"]");
    }
    Some((expression, start..start + path.len()))
}

fn dashed_prop(text: &str, schema: &PropSchema) -> bool {
    let path = text.trim_ascii();
    if !path.contains('-') {
        return false;
    }
    let mut current = Some(schema);
    for part in path.split('.') {
        if !is_prop_name(part) {
            return false;
        }
        current = current.and_then(|schema| schema.properties.as_ref()?.get(part));
        if current.is_none() && part.contains('-') {
            return false;
        }
    }
    true
}

fn is_prop_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    bytes.next().is_some_and(|byte| byte.is_ascii_alphabetic())
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}
