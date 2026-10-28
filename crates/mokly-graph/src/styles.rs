//! Configured stylesheet roots and ordered view-specific links.

use std::collections::BTreeMap;
use std::iter;

use globset::{GlobBuilder, GlobMatcher};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_css::types::StylesheetRoot;
use mokly_html::tree;
use mokly_html::tree::Node;
use mokly_model::axes::ColorScheme;
use mokly_model::routes;

use crate::delivery_inputs::DeliveryInputs;
use crate::error::{Result, invalid};
use crate::types::ResourcePlan;

/// Compiled stylesheet `match` globs, in configuration order.
/// `literal_separator` keeps `*` and `?` inside one path segment. Backslash escaping is
/// off on every platform, because globset turns it on by default only where `\` is not
/// a path separator, so the same pattern would match differently on Windows.
pub(crate) struct Matchers(Vec<GlobMatcher>);

impl Matchers {
    pub(crate) fn new(config: &ResolvedConfig) -> Result<Self> {
        let mut matchers = Vec::new();
        for rule in config.input.stylesheets.iter().flatten() {
            match GlobBuilder::new(&rule.r#match)
                .literal_separator(true)
                .backslash_escape(false)
                .build()
            {
                Ok(glob) => matchers.push(glob.compile_matcher()),
                Err(source) => {
                    return Err(invalid(
                        &rule.r#match,
                        format!("invalid stylesheet match: {source}"),
                    ));
                }
            }
        }
        Ok(Self(matchers))
    }
}

/// Collect one root per local configured stylesheet, declared component stylesheet,
/// and module CSS root. A declared file becomes a stylesheet node like a configured
/// one: an edit changes the node's input key, and changed delivered CSS changes the
/// keys of the views that link it. Local values without a repository path are skipped;
/// loading and declaration validation reject them for normal inputs.
pub(crate) fn roots(
    config: &ResolvedConfig,
    inputs: &DeliveryInputs,
) -> BTreeMap<String, StylesheetRoot> {
    let mut roots = BTreeMap::new();
    for rule in config.input.stylesheets.iter().flatten() {
        for path in rule
            .stylesheets
            .iter()
            .chain(rule.light_stylesheets.iter().flatten())
            .chain(rule.dark_stylesheets.iter().flatten())
        {
            if external(path) || path.starts_with('$') {
                continue;
            }
            let Some(logical) = config.repository_path(path) else {
                continue;
            };
            roots.entry(logical.clone()).or_insert(StylesheetRoot {
                path: logical.clone(),
                stylesheets: vec![logical],
                excluded: Default::default(),
                local_css: true,
            });
        }
    }
    for paths in inputs.component_stylesheets.values() {
        for path in paths {
            let Some(logical) = config.repository_path(path) else {
                continue;
            };
            roots.entry(logical.clone()).or_insert(StylesheetRoot {
                path: logical.clone(),
                stylesheets: vec![logical],
                excluded: Default::default(),
                local_css: true,
            });
        }
    }
    for root in &inputs.stylesheet_roots {
        roots
            .entry(root.path.clone())
            .or_insert_with(|| root.clone());
    }
    roots
}

pub(crate) struct LinkInput<'a> {
    pub(crate) matchers: &'a Matchers,
    pub(crate) config: &'a ResolvedConfig,
    pub(crate) path: &'a str,
    pub(crate) route: &'a str,
    pub(crate) scheme: ColorScheme,
    pub(crate) components: &'a [String],
    pub(crate) inputs: &'a DeliveryInputs,
    pub(crate) resources: &'a BTreeMap<String, ResourcePlan>,
    pub(crate) module: &'a str,
}

/// Build ordered stylesheet links. Local values without a repository path are skipped;
/// loading and declaration validation reject them for normal inputs.
pub(crate) fn links(input: &LinkInput<'_>) -> Result<Vec<String>> {
    let LinkInput {
        matchers,
        config,
        path,
        route,
        scheme,
        components,
        inputs,
        resources,
        module,
    } = input;
    let mut links = Vec::new();
    let component_paths: Vec<_> = components
        .iter()
        .flat_map(|component| {
            inputs
                .component_stylesheets
                .get(component)
                .into_iter()
                .flatten()
        })
        .collect();
    let mut shared = Vec::new();
    let mut specific = Vec::new();
    for (rule, matcher) in config.input.stylesheets.iter().flatten().zip(&matchers.0) {
        if !matcher.is_match(format!("{path}/index.html")) {
            continue;
        }
        shared = rule.stylesheets.clone();
        specific = match scheme {
            ColorScheme::Light => rule.light_stylesheets.clone().unwrap_or_default(),
            ColorScheme::Dark => rule.dark_stylesheets.clone().unwrap_or_default(),
        };
        break;
    }
    let configured: Vec<_> = shared
        .iter()
        .chain(&specific)
        .filter(|path| !path.starts_with('$'))
        .filter_map(|path| {
            if external(path) {
                Some(path.clone())
            } else {
                config.repository_path(path)
            }
        })
        .collect();
    let mut ordered = Vec::new();
    let mut marker = false;
    for value in shared {
        if value == "$componentStylesheets" {
            ordered.extend(
                component_paths
                    .iter()
                    .filter(|path| {
                        config
                            .repository_path(path)
                            .is_some_and(|logical| !configured.contains(&logical))
                    })
                    .map(|path| (*path).clone()),
            );
            marker = true;
        } else {
            ordered.push(value);
        }
    }
    if !marker {
        ordered.extend(
            component_paths
                .iter()
                .filter(|path| {
                    config
                        .repository_path(path)
                        .is_some_and(|logical| !configured.contains(&logical))
                })
                .map(|path| (*path).clone()),
        );
    }
    ordered.extend(specific);
    for path in ordered {
        let href = if external(&path) {
            path
        } else if let Some(logical) = config.repository_path(&path) {
            routes::relative(route, &format!("styles/{logical}"))
        } else {
            continue;
        };
        if !links.contains(&href) {
            links.push(href);
        }
    }
    for root in config
        .renderer()
        .into_iter()
        .chain(iter::once((*module).to_owned()))
    {
        let css = format!("styles/{root}.css");
        if resources.contains_key(&css) {
            let href = routes::relative(route, &css);
            if !links.contains(&href) {
                links.push(href);
            }
        }
    }
    Ok(links)
}

pub(crate) fn install(nodes: &mut [Node], stylesheets: &[String]) {
    let mut pending: Vec<_> = nodes.iter_mut().rev().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            if element.name == "head" {
                element.children.retain(|node| !matches!(node, Node::Element(element) if element.name == "link" && element.get("rel") == Some("stylesheet")));
                element.children.extend(stylesheets.iter().map(|href| {
                    tree::element("link", &[("rel", "stylesheet"), ("href", href)], Vec::new())
                }));
            } else {
                pending.extend(element.children.iter_mut().rev());
            }
        }
    }
}

fn external(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}
