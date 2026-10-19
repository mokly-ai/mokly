//! The closed state and pseudo-element lists used for selector broadening.

pub(crate) fn state(name: &str) -> bool {
    matches!(
        name,
        "hover"
            | "active"
            | "focus"
            | "focus-visible"
            | "focus-within"
            | "visited"
            | "link"
            | "any-link"
            | "checked"
            | "indeterminate"
            | "enabled"
            | "disabled"
            | "default"
            | "valid"
            | "invalid"
            | "user-valid"
            | "user-invalid"
            | "in-range"
            | "out-of-range"
            | "required"
            | "optional"
            | "read-only"
            | "read-write"
            | "placeholder-shown"
            | "autofill"
            | "target"
            | "target-within"
            | "fullscreen"
            | "modal"
            | "open"
            | "popover-open"
            | "picture-in-picture"
            | "playing"
            | "paused"
            | "seeking"
            | "buffering"
            | "stalled"
            | "muted"
            | "volume-locked"
            | "defined"
    )
}

pub(crate) fn pseudo_element(name: &str) -> bool {
    matches!(
        name,
        "before"
            | "after"
            | "first-line"
            | "first-letter"
            | "selection"
            | "marker"
            | "placeholder"
            | "backdrop"
            | "file-selector-button"
            | "spelling-error"
            | "grammar-error"
            | "cue"
            | "cue-region"
            | "target-text"
            | "details-content"
    )
}
