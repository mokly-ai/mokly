//! Former rendered-HTML navigation cases use the core's final tree rewrite.

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, UseCaseStep};

use crate::error::Result;
use crate::{controls, links, parse, serialize};

#[test]
fn native_controls_keep_fragments_separate_from_paths_and_output_attributes() {
    let mut invalid = parse::fragment("<button to=\"details#summary\">Bad</button>");
    let error = controls::adapt(&mut invalid, "route").unwrap_err();
    assert!(
        error
            .to_string()
            .ends_with("MockLink destination and fragment must be separate unencoded values")
    );
    let mut nodes = parse::fragment("<button to=\"details\" fragment=\"summary\">Details</button>");
    assert!(controls::adapt(&mut nodes, "route").unwrap().is_empty());
    let html = serialize::html(&nodes);
    assert!(html.contains("href=\"mock:details#summary\""));
    assert!(!html.contains("fragment="));
}

fn rewritten(body: &str, scheme: ColorScheme) -> Result<String> {
    let prepared = super::support::prepared("<p>{{label}}</p>");
    let source = prepared
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap()
        .clone();
    let mut target = source.clone();
    target.metadata.path = "details".into();
    if let EntryContent::Screen { visual, .. } = &mut target.content {
        visual.color_schemes = vec![ColorScheme::Light];
    }
    let mut tour = source.clone();
    tour.metadata.path = "tour".into();
    tour.content = EntryContent::UseCase {
        steps: vec![UseCaseStep {
            screen_path: "details".into(),
            title: None,
            description: None,
        }],
    };
    let entries = [source.clone(), target, tour];
    let mut nodes = parse::document(&format!(
        "<!doctype html><html><head></head><body>{body}</body></html>"
    ));
    links::rewrite(
        &mut nodes,
        &entries,
        &source,
        "home/index.mobile.html",
        Viewport::Mobile,
        scheme,
    )?;
    Ok(serialize::html(&nodes))
}

#[test]
fn native_anchors_areas_svg_and_dual_attributes_keep_exact_logical_ownership() {
    let html = rewritten("<a href='mock:details'>Anchor</a><map name='links'><area href='mock:details' shape='default'></map><svg><a href='mock:details'><text>SVG</text></a></svg><span data-nav-href='mock:details'>Metadata</span><a href='mock:details' data-nav-href='mock:details'>Dual</a>", ColorScheme::Light).unwrap();
    assert_eq!(html.matches("data-mokly-link=\"details\"").count(), 4);
    assert!(html.contains("<span data-nav-href=\"../details/index.mobile.html\">Metadata</span>"));
    for body in [
        "<div href='mock:details'></div>",
        "<link href='mock:details' rel='stylesheet'>",
        "<svg><use href='mock:details'></use></svg>",
        "<svg><image href='mock:details'></image></svg>",
    ] {
        assert!(rewritten(body, ColorScheme::Light).is_err(), "{body}");
    }
    let html = rewritten("<div data-nav-href='mock:details'></div><link data-nav-href='mock:details'><svg><use data-nav-href='mock:details'></use><image data-nav-href='mock:details'></image></svg>", ColorScheme::Light).unwrap();
    assert_eq!(
        html.matches("data-nav-href=\"../details/index.mobile.html\"")
            .count(),
        4
    );
    assert!(!html.contains("data-mokly-link="));
}

#[test]
fn only_complete_decoded_logical_values_change_and_use_cases_keep_their_identity() {
    let html = rewritten("<a href='&#109;ock:details'>Encoded</a><p title='href=mock:details'>mock:details</p><!-- href=mock:details --><a href='https://site.test/mock:details'>External</a><a href='mock:tour#summary'>Tour</a>", ColorScheme::Dark).unwrap();
    assert!(html.contains("href=\"../details/index.mobile.html\""));
    assert!(html.contains("<p title=\"href=mock:details\">mock:details</p>"));
    assert!(html.contains("<!-- href=mock:details -->"));
    assert!(html.contains("href=\"https://site.test/mock:details\""));
    assert!(html.contains(
        "href=\"../details/index.mobile.html#summary\" data-mokly-link=\"tour#summary\""
    ));
    assert!(!html.contains("index.mobile.dark.html"));
}

#[test]
fn logical_target_syntax_reserved_metadata_and_conflicting_attributes_fail_closed() {
    for body in [
        "<a href='mock:details#unsafe/section'></a>",
        "<a href='mock:details#section%20name'></a>",
        "<a href='mock:details?query'></a>",
        "<a href='mock:missing'></a>",
        "<span data-nav-href='mock:missing'></span>",
        "<a data-mokly-link='details' href='mock:details'></a>",
        "<a href='mock:details' data-nav-href='mock:home'></a>",
        "<a href='mock:../outside'></a>",
    ] {
        assert!(rewritten(body, ColorScheme::Light).is_err(), "{body}");
    }
}

#[test]
fn page_base_targets_are_kept_but_active_links_reject_base_urls() {
    assert!(
        rewritten(
            "<base href='https://site.test/'><a href='mock:details'>Go</a>",
            ColorScheme::Light
        )
        .is_err()
    );
    let target = rewritten(
        "<base target='catalogue'><a href='mock:details'>Go</a>",
        ColorScheme::Light,
    )
    .unwrap();
    assert!(target.contains("<base target=\"catalogue\">"));
    assert!(target.contains("data-mokly-target=\"catalogue\""));
    assert!(
        rewritten(
            "<base href='https://site.test/'><span data-nav-href='mock:details'>Metadata</span>",
            ColorScheme::Light
        )
        .is_ok()
    );
}
