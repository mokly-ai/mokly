//! Logical catalogue links, portable destinations, and cross-view anchor records.

use std::collections::BTreeMap;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::paths::is_entry_path;
use mokly_model::routes;
use unicode_general_category::{GeneralCategory, get_general_category};

use crate::error;
use crate::error::{Result, invalid};
use crate::link_targets::{first_base, request_target};
use crate::tree::Node;

/// Final logical reference, validated against all destination views by the graph.
#[derive(Clone, Debug)]
pub struct Reference {
    /// Referring route retained for final anchor diagnostics.
    pub source_route: String,
    /// Resolved complete catalogue path.
    pub target: String,
    /// Bare Unicode HTML id, when supplied.
    pub fragment: Option<String>,
}

/// Rewrite catalogue destinations after controls have adapted.
pub fn rewrite(
    nodes: &mut [Node],
    entries: &[ModelEntry],
    source: &ModelEntry,
    route: &str,
    viewport: Viewport,
    scheme: ColorScheme,
) -> Result<Vec<Reference>> {
    let index: BTreeMap<_, _> = entries
        .iter()
        .map(|entry| (entry.metadata.path.to_ascii_lowercase(), entry))
        .collect();
    let mut references = Vec::new();
    let base_target = first_base(nodes, "target");
    let context = LinkContext {
        entries: &index,
        source,
        route,
        viewport,
        scheme,
        base_target: base_target.as_deref(),
    };
    let active = match walk(nodes, &context, &mut references) {
        Ok(active) => active,
        Err(source) => {
            return Err(error::HtmlError::Route {
                route: route.into(),
                source: Box::new(source),
            });
        }
    };
    if active && first_base(nodes, "href").is_some() {
        return Err(invalid(
            "build-invalid",
            "a document with an activatable catalogue link cannot contain <base href>",
        ));
    }
    Ok(references)
}

struct LinkContext<'a> {
    entries: &'a BTreeMap<String, &'a ModelEntry>,
    source: &'a ModelEntry,
    route: &'a str,
    viewport: Viewport,
    scheme: ColorScheme,
    base_target: Option<&'a str>,
}

fn walk(
    nodes: &mut [Node],
    context: &LinkContext<'_>,
    references: &mut Vec<Reference>,
) -> Result<bool> {
    let LinkContext {
        entries,
        source,
        route,
        viewport,
        scheme,
        base_target,
    } = *context;
    let mut active = false;
    for node in nodes {
        match node {
            Node::Region { children, .. } => active |= walk(children, context, references)?,
            Node::Element(element) => {
                if element.get("data-mokly-link").is_some() {
                    return Err(invalid(
                        "build-invalid",
                        "data-mokly-link is reserved for Mokly",
                    ));
                }
                element.take("data-mokly-target");
                let mut destination = None;
                for attribute in ["href", "data-nav-href"] {
                    if let Some(logical) = element
                        .get(attribute)
                        .and_then(|value| value.strip_prefix("mock:"))
                        .map(str::to_owned)
                    {
                        if attribute == "href"
                            && !((element.is_html()
                                && matches!(element.name.as_str(), "a" | "area"))
                                || (element.namespace == "http://www.w3.org/2000/svg"
                                    && element.name == "a"))
                        {
                            return Err(invalid(
                                "build-invalid",
                                format!("logical href is not allowed on <{}>", element.name),
                            ));
                        }
                        let (path, fragment) = logical
                            .split_once('#')
                            .map_or((logical.as_str(), None), |(path, fragment)| {
                                (path, Some(fragment))
                            });
                        if fragment.is_some_and(|fragment| !valid_fragment(fragment)) {
                            return Err(invalid(
                                "build-invalid",
                                format!("invalid logical fragment in mock:{logical}"),
                            ));
                        }
                        let path = resolve_path(path, source, entries)?;
                        let complete = format!(
                            "{path}{}",
                            fragment.map_or(String::new(), |f| format!("#{f}"))
                        );
                        if destination.as_ref().is_some_and(|other| other != &complete) {
                            return Err(invalid(
                                "build-invalid",
                                "conflicting logical navigation destinations",
                            ));
                        }
                        destination = Some(complete.clone());
                        let target = entries.get(&path.to_ascii_lowercase()).ok_or_else(|| {
                            invalid(
                                "unknown-link-target",
                                format!("unknown catalogue target {path}"),
                            )
                        })?;
                        let target_route = destination_route(target, entries, viewport, scheme)?;
                        let href = routes::relative(route, &target_route)
                            + &fragment
                                .map_or(String::new(), |f| format!("#{}", routes::encode(f)));
                        element.set(attribute, href);
                        references.push(Reference {
                            source_route: route.into(),
                            target: path,
                            fragment: fragment.map(str::to_owned),
                        });
                        element.navigation = references.last().cloned();
                        if attribute == "href" {
                            active = true;
                            element.set("data-mokly-link", complete);
                            if let Some(target) = element.get("target").or(base_target) {
                                let target = request_target(target)?;
                                if let Some(target) = target {
                                    element.set("data-mokly-target", target);
                                }
                            }
                        }
                    }
                }
                active |= walk(&mut element.children, context, references)?;
            }
            _ => {}
        }
    }
    Ok(active)
}

fn resolve_path(
    path: &str,
    source: &ModelEntry,
    entries: &BTreeMap<String, &ModelEntry>,
) -> Result<String> {
    let parent = source
        .metadata
        .variant_of
        .as_ref()
        .and_then(|parent| entries.get(&parent.to_ascii_lowercase()))
        .copied()
        .unwrap_or(source);
    let base = if parent.metadata.is_index {
        parent.metadata.path.as_str()
    } else {
        parent
            .metadata
            .path
            .rsplit_once('/')
            .map_or("", |(folder, _)| folder)
    };
    let path = if path.starts_with("./") || path.starts_with("../") {
        routes::resolve(format!("{base}/index.html").trim_start_matches('/'), path)
    } else {
        Some(path.into())
    };
    let path = path.filter(|path| is_entry_path(path)).ok_or_else(|| {
        invalid(
            "build-invalid",
            "logical destination is not a valid catalogue path",
        )
    })?;
    if let Some(target) = entries.get(&path.to_ascii_lowercase()) {
        return Ok(target.metadata.path.clone());
    }
    if let Some(target) = entries.values().find(|entry| {
        entry
            .metadata
            .moved_from
            .as_deref()
            .is_some_and(|previous| previous.eq_ignore_ascii_case(&path))
    }) {
        return Err(invalid(
            "moved-link-target",
            format!("target {path} moved to {}", target.metadata.path),
        ));
    }
    Err(invalid(
        "unknown-link-target",
        format!("unknown catalogue target {path}"),
    ))
}

fn destination_route(
    entry: &ModelEntry,
    entries: &BTreeMap<String, &ModelEntry>,
    viewport: Viewport,
    scheme: ColorScheme,
) -> Result<String> {
    let path = &entry.metadata.path;
    Ok(match &entry.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
            routes::view(
                path,
                viewport,
                if visual.color_schemes.contains(&scheme) {
                    scheme
                } else {
                    ColorScheme::Light
                },
            )
        }
        EntryContent::Page => routes::document(path, ColorScheme::Light),
        EntryContent::Document { color_schemes, .. } => routes::document(
            path,
            if color_schemes.contains(&scheme) {
                scheme
            } else {
                ColorScheme::Light
            },
        ),
        EntryContent::UseCase { steps } => {
            let screen = steps
                .first()
                .and_then(|step| entries.get(&step.screen_path.to_ascii_lowercase()))
                .ok_or_else(|| invalid("build-invalid", "use case link has no first screen"))?;
            destination_route(screen, entries, viewport, scheme)?
        }
    })
}

/// Logical fragment grammar, independent of CSS selector syntax.
pub fn valid_fragment(fragment: &str) -> bool {
    !fragment.is_empty()
        && fragment.chars().all(|c| {
            c.is_alphanumeric()
                || "_:.-".contains(c)
                || matches!(
                    get_general_category(c),
                    GeneralCategory::NonspacingMark
                        | GeneralCategory::SpacingMark
                        | GeneralCategory::EnclosingMark
                )
        })
}
