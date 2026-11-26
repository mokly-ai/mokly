//! The platform-neutral groups of the native scope. The parent module states
//! the rule that each entry meets.

use super::Neutral::{self, Binary, Module, Test};

/// The nextest binary ID of the `mokly-render` integration test binary.
const RENDER: &str = "mokly-render::integration_tests";

/// CSS attribution and rule ownership. The tests decide which component owns
/// a matched rule. Rule matching and the ownership proof read parsed CSS and
/// rendered trees in memory.
pub(super) const CSS_ATTRIBUTION: &[Neutral] = &[
    Binary("mokly-cli::changes_containment_tests"),
    Binary("mokly-cli::changes_declared_ancestor_tests"),
    Binary("mokly-cli::changes_nested_proof_tests"),
    Binary("mokly-cli::changes_registry_ownership_tests"),
    Binary("mokly-cli::changes_supplier_tests"),
    Binary("mokly-compare::css_engine_tests"),
    Binary("mokly-compare::inline_engine_tests"),
    Binary("mokly-css::match_proof_tests"),
    Module(RENDER, "integration::base_styles_tests"),
    Module(RENDER, "integration::containment_tests"),
    Module(RENDER, "integration::owned_catalogue_tests"),
    Module(RENDER, "integration::owned_rule_tests"),
    Module(RENDER, "integration::ownership_tests"),
    Module(RENDER, "integration::registry_matrix_tests"),
    Module(RENDER, "integration::supplier_containment_tests"),
    Binary("mokly-cli::changes_owned_styles_tests"),
    Test(
        "mokly-compare::resource_engine_tests",
        "an_embedded_stylesheet_matches_its_own_document_and_cannot_match_the_host",
    ),
    Test(
        "mokly-compare::resource_engine_tests",
        "public_css_parse_failures_are_unresolved_without_partial_selector_claims",
    ),
];

/// Changes classification. The tests decide whether an entry, a view, or a
/// usage changed from two catalogue models, or which base the comparison
/// selects. The fixture repositories commit without line-ending conversion,
/// and no test checks a path, a file name, or its case. On Windows the
/// product reads the base with the host Git settings, which can convert line
/// endings. Kept tests check that a converted base still compares equal.
pub(super) const CHANGES_CLASSIFICATION: &[Neutral] = &[
    Binary("mokly-cli::changes_plaintext_root_tests"),
    Binary("mokly-cli::changes_view_sides_tests"),
    Binary("mokly-compare::affected_donor_tests"),
    Binary("mokly-compare::byte_equal_engine_tests"),
    Binary("mokly-compare::impact_engine_tests"),
    Binary("mokly-compare::instance_engine_tests"),
    Binary("mokly-compare::metadata_engine_tests"),
    Binary("mokly-compare::page_similarity_tests"),
    Binary("mokly-cli::changes_names_tests"),
    Binary("mokly-compare::engine_tests"),
    Test(
        "mokly-cli::changes_edge_tests",
        "a_catalogue_added_after_the_base_has_every_current_entry_added",
    ),
    Test(
        "mokly-cli::changes_pinning_tests",
        "base_lookup_emits_one_span_before_rendering_on_success_or_failure",
    ),
    Test(
        "mokly-cli::changes_static_tests",
        "static_build_retains_changes_and_selects_the_explicit_base_once",
    ),
    Test(
        "mokly-compare::branch_point_cases_tests",
        "rust_only_shapes_keep_base_titles_new_slugs_and_detected_moves",
    ),
    Test(
        "mokly-compare::move_engine_tests",
        "an_unmatched_variant_declaration_stays_blocked_when_its_parent_pairs",
    ),
    Test(
        "mokly-compare::move_engine_tests",
        "moving_link_targets_is_normalized_before_later_identical_content_passes",
    ),
    Test(
        "mokly-compare::move_engine_tests",
        "parent_moves_claim_same_slug_variants_and_preserve_removed_parent_titles",
    ),
    Test(
        "mokly-compare::move_engine_tests",
        "pure_moved_references_do_not_propagate_screen_reasons_into_a_flow",
    ),
    Test(
        "mokly-compare::move_engine_tests",
        "relocated_image_references_require_paired_byte_proof",
    ),
];

/// Scale proofs. The tests count operations, such as Git read requests, over
/// generated catalogues, at two sizes or under cache eviction, and assert no
/// elapsed time.
pub(super) const SCALE_COUNTS: &[Neutral] = &[
    Binary("mokly-compare::planning_io_tests"),
    Binary("mokly-compare::scale_engine_tests"),
];

/// Authoring rules of the catalogue model: component declarations, control
/// bounds, slot order, warnings, validation codes, render diagnostics, and
/// design contracts, also for the base side of Changes. A diagnostic names
/// its source by a logical path. The kept
/// `changes_javascript_tests::historical_javascript_validation_keeps_typed_diagnostics_and_current_build`
/// checks that a base diagnostic path keeps that form on every platform.
pub(super) const AUTHORING_RULES: &[Neutral] = &[
    Binary("mokly-cli::design_behaviour_tests"),
    Binary("mokly-cli::unsafe_html_warning_tests"),
    Module(RENDER, "integration::declaration_tests"),
    Module(RENDER, "integration::review_validation_tests"),
    Module(RENDER, "integration::slot_order_tests"),
    Test(
        "mokly-cli::changes_build_tests",
        "base_validation_failure_keeps_the_head_catalogue_and_prints_each_source_diagnostic",
    ),
    Test(
        "mokly-cli::changes_build_tests",
        "strict_mode_ignores_fixed_historical_authoring_warnings",
    ),
    Binary("mokly-cli::ignore_warning_tests"),
    Test(
        "mokly-cli::review_render_tests",
        "dynamic_unknown_and_moved_destinations_use_the_protocol_messages_once",
    ),
    Test(
        "mokly-cli::review_render_tests",
        "invalid_ignore_ids_and_unknown_wrapper_attributes_have_exact_diagnostics",
    ),
    Test(
        "mokly-cli::review_render_tests",
        "missing_required_component_props_keep_the_named_diagnostic",
    ),
    Test(
        "mokly-cli::review_render_tests",
        "unsafe_url_schemes_name_the_attribute_url_and_source_once",
    ),
    Module(RENDER, "integration::validation_tests"),
];

/// HTML parsing, repair, and composition of rendered documents in memory, and
/// the reuse of rendered fragments and stylesheets inside one generation.
pub(super) const HTML_COMPOSITION: &[Neutral] = &[
    Binary("mokly-graph::collection_tests"),
    Binary("mokly-graph::final_tree_tests"),
    Binary("mokly-graph::html_repair_tests"),
    Binary("mokly-graph::ignore_key_tests"),
    Binary("mokly-graph::plaintext_tests"),
    Test(
        RENDER,
        "integration::cache_tests::evicted_styles_keep_the_generation_source_snapshot",
    ),
    Test(
        RENDER,
        "integration::cache_tests::temporary_props_reuse_fragments_without_changing_saved_documents",
    ),
];
