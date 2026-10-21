//! HTML token validation shared by screens, components, and complete pages.

use std::collections::BTreeSet;

use html5gum::{StartTag, Token};
use mokly_model::catalogue::SourceLocation;
use mokly_model::prop_schema::PropSchema;

use crate::diagnostic::{Code, Issue, Warning, WarningSubject};
use crate::html_tokens;
use crate::locations::at;
use crate::references::{boolean, reference, substitutions, use_reference};
use crate::template_types::{ElementRegistry, Template};

pub(crate) struct Validation {
    pub(crate) issues: Vec<Issue>,
    pub(crate) warnings: Vec<Warning>,
    pub(crate) components: BTreeSet<String>,
}

pub(crate) fn validate(
    template: &Template,
    path: &str,
    schema: &PropSchema,
    slots: Option<&[String]>,
    registry: &ElementRegistry,
    failed: &BTreeSet<String>,
    warn_unused_props: bool,
) -> Validation {
    let mut checker = Checker {
        template,
        path,
        schema,
        slots,
        registry,
        failed,
        used: BTreeSet::new(),
        stack: Vec::new(),
        result: Validation {
            issues: Vec::new(),
            warnings: Vec::new(),
            components: BTreeSet::new(),
        },
    };
    let mut document_tags = [0, 0, 0];
    let mut warned_attributes = BTreeSet::new();
    for parsed in html_tokens::parse(&template.body) {
        match parsed.token {
            Token::StartTag(tag) => {
                for attribute in parsed.ignored_attributes {
                    if !warned_attributes.insert(attribute.clone()) {
                        continue;
                    }
                    checker.result.warnings.push(Warning {
                        code: "html-ignore-attribute",
                        subject: if slots.is_some() {
                            WarningSubject::Component(path.into())
                        } else {
                            WarningSubject::Entry(path.into())
                        },
                        message: html_tokens::ignore_warning_message(&attribute, &tag.name),
                    });
                }
                for (i, name) in ["html", "head", "body"].iter().enumerate() {
                    if tag.name.as_ref() == name.as_bytes() {
                        document_tags[i] += 1;
                    }
                }
                checker.start(tag);
            }
            Token::EndTag(tag) => {
                let name = String::from_utf8_lossy(&tag.name);
                if let Some(index) = checker
                    .stack
                    .iter()
                    .rposition(|entry| entry == name.as_ref())
                {
                    checker.stack.truncate(index);
                }
            }
            Token::String(text) => {
                let text_value = String::from_utf8_lossy(&text.value);
                checker.substitutions(&text_value, text.span.start);
                if !text_value.trim().is_empty() {
                    checker.slot_content("children", text.span.start);
                }
            }
            _ => {}
        }
    }
    if template.page
        && (!template
            .body
            .trim_start()
            .to_ascii_lowercase()
            .starts_with("<!doctype html>")
            || document_tags != [1, 1, 1])
    {
        checker.fail(
            Code::HtmlElement,
            "page must start with <!doctype html> and contain one html, head and body element",
            0,
        );
    }
    for name in schema
        .properties
        .iter()
        .flat_map(|props| props.keys())
        .filter(|_| warn_unused_props)
    {
        if !checker.used.contains(name) {
            checker.result.warnings.push(Warning {
                code: "html-unused-props",
                subject: if slots.is_some() {
                    WarningSubject::Component(path.into())
                } else {
                    WarningSubject::Entry(path.into())
                },
                message: format!("prop {name:?} is not read by the body"),
            });
        }
    }
    checker.result
}

struct Checker<'a> {
    template: &'a Template,
    path: &'a str,
    schema: &'a PropSchema,
    slots: Option<&'a [String]>,
    registry: &'a ElementRegistry,
    failed: &'a BTreeSet<String>,
    used: BTreeSet<String>,
    stack: Vec<String>,
    result: Validation,
}

impl Checker<'_> {
    fn location(&self, offset: usize) -> SourceLocation {
        at(
            &self.template.source_path,
            &self.template.source,
            self.template.body_offset + offset,
        )
    }
    fn fail(&mut self, code: Code, message: impl Into<String>, offset: usize) {
        self.result
            .issues
            .push(Issue::new(code, message).at(self.location(offset)));
    }
    fn substitutions(&mut self, text: &str, offset: usize) {
        for (start, name) in substitutions(text) {
            if let Err(message) = use_reference(self.schema, name, true, &mut self.used) {
                self.fail(Code::HtmlProps, message, offset + start);
            }
        }
    }
    fn slot_content(&mut self, name: &str, offset: usize) {
        if let Some(parent) = self.stack.last().and_then(|name| self.registry.get(name))
            && !self.failed.contains(&parent.path)
            && !parent.slots.iter().any(|slot| slot == name)
        {
            self.fail(
                Code::HtmlSlot,
                format!("component {} does not declare slot {name}", parent.path),
                offset,
            );
        }
    }
    fn start(&mut self, tag: StartTag<usize>) {
        let name = String::from_utf8_lossy(&tag.name).into_owned();
        let component = self.registry.get(&name);
        if (!self.template.page
            && matches!(name.as_str(), "script" | "html" | "head" | "body" | "base"))
            || (name.starts_with("mokly-")
                && !matches!(name.as_str(), "mokly-ignore" | "mokly-ignore-scope"))
        {
            self.fail(
                Code::HtmlElement,
                format!("forbidden element {name}"),
                tag.span.start,
            );
        } else if name.contains('-') && !name.starts_with("mokly-") && component.is_none() {
            self.fail(
                Code::HtmlElement,
                format!("unknown element {name}"),
                tag.span.start,
            );
        }
        let slot_name = tag
            .attributes
            .iter()
            .find(|(name, _)| name.as_ref() == b"slot")
            .map(|(_, value)| String::from_utf8_lossy(&value.value).into_owned())
            .unwrap_or_else(|| "children".into());
        self.slot_content(&slot_name, tag.span.start);
        if name == "slot" {
            let slot = tag
                .attributes
                .iter()
                .find(|(name, _)| name.as_ref() == b"name")
                .map(|(_, value)| String::from_utf8_lossy(&value.value).into_owned())
                .unwrap_or_else(|| "children".into());
            if !self.slots.is_some_and(|slots| slots.contains(&slot)) {
                self.fail(
                    Code::HtmlSlot,
                    format!("undeclared slot placeholder {slot}"),
                    tag.span.start,
                );
            }
        }
        if let Some(component) = component {
            self.result.components.insert(component.path.clone());
            let table = self.stack.iter().rposition(|name| name == "table");
            if table.is_some_and(|index| {
                !self.stack[index + 1..]
                    .iter()
                    .any(|name| matches!(name.as_str(), "td" | "th" | "caption"))
            }) {
                self.result.warnings.push(Warning {
                    code: "html-foster-parented",
                    subject: if self.slots.is_some() {
                        WarningSubject::Component(self.path.into())
                    } else {
                        WarningSubject::Entry(self.path.into())
                    },
                    message: format!(
                        "component element {name} is moved out of <{}> by HTML parsing",
                        self.stack.last().map_or("table", String::as_str)
                    ),
                });
            }
        }
        for (attribute, value) in &tag.attributes {
            let attribute = String::from_utf8_lossy(attribute);
            let text = String::from_utf8_lossy(&value.value);
            self.substitutions(&text, value.span.start);
            if attribute == "mokly-if" {
                match text
                    .strip_prefix('$')
                    .and_then(|name| reference(self.schema, name).map(|prop| (name, prop)))
                {
                    Some((name, prop)) if boolean(prop) => {
                        self.used
                            .insert(name.split('.').next().unwrap_or(name).into());
                    }
                    _ => self.fail(
                        Code::HtmlProps,
                        format!("mokly-if {text:?} must name a declared boolean prop"),
                        value.span.start,
                    ),
                }
            } else if attribute == "mokly-viewport"
                && !matches!(text.as_ref(), "mobile" | "desktop")
            {
                self.fail(
                    Code::HtmlAttribute,
                    "mokly-viewport must be mobile or desktop",
                    value.span.start,
                );
            } else if component.is_some()
                && text.starts_with('$')
                && !text.starts_with("$$")
                && let Err(message) = use_reference(self.schema, &text[1..], false, &mut self.used)
            {
                self.fail(Code::HtmlProps, message, value.span.start);
            }
        }
        if !tag.self_closing
            && !matches!(
                name.as_str(),
                "area"
                    | "base"
                    | "br"
                    | "col"
                    | "embed"
                    | "hr"
                    | "img"
                    | "input"
                    | "link"
                    | "meta"
                    | "param"
                    | "source"
                    | "track"
                    | "wbr"
            )
        {
            self.stack.push(name);
        }
    }
}
