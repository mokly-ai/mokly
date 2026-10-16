//! Rule diffs retain authored order, complete failures, and selector proofs.

use std::collections::BTreeMap;

use mokly_model::evidence::EvidenceOwner;
use mokly_model::review_affected::ReviewSide;

use crate::match_tree::{MatchElement, MatchTree};
use crate::parsed_cache::{MemoryParsedCss, ParsedCssCache};
use crate::rule_collection::collect;
use crate::rule_matching::{DocumentMatching, match_document};
use crate::rules::{ParsedCss, RuleDiff, diff};

#[test]
fn declaration_order_multisets_conditions_and_complete_failures() {
    let before = collect(b".x { color:red; color:blue!important; color:green } .x{color:red} @media (width: 1px){.y{color:blue}}");
    let after = collect(b"@media(width:1px){.y{color:red}} .x{color:red}.x{color:red;color:blue!important;color:green}");
    let RuleDiff::Resolved {
        added,
        removed,
        changed,
    } = diff(&before, &after)
    else {
        panic!()
    };
    assert!(added.is_empty());
    assert!(removed.is_empty());
    assert_eq!(changed.len(), 1);
    let ParsedCss::Rules(rules) = before else {
        panic!()
    };
    assert_eq!(
        rules[0].declarations,
        "color:red;color:blue!important;color:green"
    );
    assert_eq!(rules[2].conditions[0].kind.as_str(), "media");
    let RuleDiff::Unresolved(failures) = diff(&collect(b".a{"), &collect(b"/*")) else {
        panic!()
    };
    assert_eq!(failures.len(), 2);
    assert_eq!(failures[0].side, ReviewSide::Before);
    assert_eq!(failures[1].side, ReviewSide::After);
}

#[test]
fn parsed_cache_shares_equal_bytes_and_obeys_its_byte_bound() {
    let cache: &dyn ParsedCssCache = &MemoryParsedCss::new(16384);
    cache.parse(b".a{color:red}");
    cache.parse(b".a{color:red}");
    assert_eq!(cache.stats().parses, 1);
    assert_eq!(cache.stats().hits, 1);
    assert!(cache.stats().bytes <= 16384);
    let cache: &dyn ParsedCssCache = &MemoryParsedCss::new(0);
    cache.parse(b".a{color:red}");
    cache.parse(b".a{color:red}");
    assert_eq!(cache.stats().parses, 2);
    assert_eq!(cache.stats().bytes, 0);
}

#[test]
fn selectors_match_static_structure_and_broaden_state_without_restrictive_negation() {
    let tree = MatchTree {
        elements: vec![
            node("main", "parent", None, vec![1]),
            node("button", "button", Some(0), vec![]),
        ],
    };
    for selector in [
        ".button",
        ".parent > .button",
        ".button:hover",
        ".button:not(:hover)",
        ".button::before",
        ".button:is(:hover,.missing)",
        ".button:nth-child(1)",
        ".button:nth-child(2 of :hover)",
        "[class=button]",
    ] {
        let outcome = analyse(selector, &tree);
        assert!(!outcome.0, "{selector} unexpectedly unresolved");
        assert!(outcome.1 > 0, "{selector} has no potential match");
    }
    assert_eq!(analyse(".button:nth-child(2)", &tree), (false, 0));
    assert_eq!(analyse(".missing", &tree), (false, 0));
    for selector in [
        "*",
        ":root",
        "html",
        "body",
        ".button:not(body)",
        ".button:host",
        ".button::part(x)",
        ".button:unknown",
    ] {
        assert!(
            analyse(selector, &tree).0,
            "{selector} must stay unresolved"
        );
    }
    assert!(!analyse("[data-x='body * :host']", &tree).0);
}

fn analyse(selector: &str, tree: &MatchTree) -> (bool, usize) {
    let source = format!("{selector}{{color:red}}");
    let diff = diff(&collect(b""), &collect(source.as_bytes()));
    let DocumentMatching::Resolved(rules) = match_document(&diff, None, Some(tree)) else {
        return (true, 0);
    };
    (
        rules
            .iter()
            .flat_map(|rule| &rule.selectors)
            .any(|selector| selector.unresolved),
        rules
            .iter()
            .flat_map(|rule| &rule.selectors)
            .map(|selector| selector.elements.len())
            .sum(),
    )
}

fn node(name: &str, class: &str, parent: Option<usize>, children: Vec<usize>) -> MatchElement {
    MatchElement {
        name: name.into(),
        namespace: "http://www.w3.org/1999/xhtml".into(),
        attributes: BTreeMap::from([("class".into(), class.into())]),
        parent,
        children,
        text: false,
        regions: Vec::new(),
        owner: EvidenceOwner::Entry,
    }
}

#[test]
fn nested_declaration_runs_are_separate_ampersand_rules_in_depth_first_order() {
    let ParsedCss::Rules(rules) =
        collect(b".a {color:red; & .b{color:blue} color:green; @media(width:1px){color:black} }")
    else {
        panic!()
    };
    assert_eq!(rules.len(), 4);
    assert_eq!(rules[0].selectors, [".a"]);
    assert_eq!(rules[1].selectors, ["& .b"]);
    assert_eq!(rules[2].selectors, ["&"]);
    assert_eq!(rules[3].selectors, ["&"]);
    assert_eq!(rules[2].conditions[0].kind.as_str(), "nesting-parent");
    assert_eq!(
        rules[3]
            .conditions
            .iter()
            .map(|condition| condition.kind.as_str())
            .collect::<Vec<_>>(),
        ["nesting-parent", "media"]
    );
}

#[test]
fn changed_custom_properties_and_urls_are_kept_while_equal_values_do_not_widen_rules() {
    let tree = MatchTree::default();
    for (before, after, unresolved) in [
        (".none{--x:1;color:red}", ".none{--x:1;color:blue}", false),
        (".none{--x:1}", ".none{color:red}", true),
        (
            ".none{background:url(a.svg);color:red}",
            ".none{background:url(a.svg);color:blue}",
            false,
        ),
        (
            ".none{background:url(a.svg)}",
            ".none{background:url(b.svg)}",
            true,
        ),
    ] {
        let DocumentMatching::Resolved(rules) = match_document(
            &diff(&collect(before.as_bytes()), &collect(after.as_bytes())),
            Some(&tree),
            None,
        ) else {
            panic!()
        };
        assert_eq!(
            rules[0].selectors[0].unresolved, unresolved,
            "{before} -> {after}"
        );
    }
    let ParsedCss::Rules(rules) = collect(b".a{x:url/**/(\"a.svg\");y:url(\"a.svg\")}") else {
        panic!()
    };
    assert!(rules[0].declarations.contains("url ("));
}

#[test]
fn literal_ampersands_in_nested_attributes_do_not_replace_nesting_tokens() {
    let tree = MatchTree {
        elements: vec![
            node("main", "parent", None, vec![1]),
            node("button", "button", Some(0), vec![]),
        ],
    };
    let mut tree = tree;
    tree.elements[1]
        .attributes
        .insert("data-v".into(), "&".into());
    let diff = diff(
        &collect(b""),
        &collect(b".parent{.button[data-v='&']{color:red}}"),
    );
    let DocumentMatching::Resolved(rules) = match_document(&diff, None, Some(&tree)) else {
        panic!()
    };
    assert!(!rules[0].selectors[0].unresolved);
    assert_eq!(rules[0].selectors[0].elements.len(), 1);
}

#[test]
fn opaque_bodies_keep_selector_whitespace_and_css_boundary_tokens_are_ignored() {
    let RuleDiff::Resolved { changed, .. } = diff(
        &collect(b"@unknown {.a .b{color:red}}"),
        &collect(b"@unknown {.a.b{color:red}}"),
    ) else {
        panic!()
    };
    assert_eq!(changed.len(), 1);
    let ParsedCss::Rules(rules) = collect("\u{feff}<!-- .a{color:red} -->".as_bytes()) else {
        panic!()
    };
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].selectors, [".a"]);
}

#[test]
fn malformed_document_arenas_keep_rules_unresolved_without_partial_matching() {
    let tree = MatchTree {
        elements: vec![node("p", "x", Some(99), vec![])],
    };
    let DocumentMatching::Resolved(rules) = match_document(
        &diff(&collect(b""), &collect(b".x{color:red}")),
        None,
        Some(&tree),
    ) else {
        panic!()
    };
    assert!(rules[0].selectors[0].unresolved);
}
