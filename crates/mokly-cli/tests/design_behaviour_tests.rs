//! Focused design contracts over real, lazily rendered catalogue documents.

mod design_behaviour;

#[test]
fn design_parent_views_use_the_parents_own_props() {
    design_behaviour::own_props::check();
}

#[test]
fn design_stacked_versions_share_one_frame_and_viewport() {
    design_behaviour::stacks::check();
}

#[test]
fn design_comparison_captions_agree_with_recorded_changes() {
    design_behaviour::captions::check();
}

#[test]
fn design_checklist_has_one_change_and_no_consumers() {
    design_behaviour::checklist::check();
}
