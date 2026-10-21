//! Phase markers retain a deterministic summary for timeout presentation.

use super::PhaseState;

#[test]
fn phase_summary_lists_completed_and_running_phases() {
    let phases = PhaseState::default();
    assert!(phases.record(
        r#"[mokly:postcss-phase] {"phase":"spawn","event":"end","elapsedMs":4,"durationMs":3}"#,
    ));
    assert!(phases.record(
        r#"[mokly:postcss-phase] {"phase":"stylesheet-run","event":"start","elapsedMs":8}"#,
    ));
    assert_eq!(
        phases.summary().as_deref(),
        Some(
            "PostCSS phases: spawn=complete 3ms, config-load=not-started, plugin-construction=not-started, stylesheet-run=running at 8ms"
        ),
    );
}

#[test]
fn resetting_a_stylesheet_run_preserves_setup_phases() {
    let phases = PhaseState::default();
    assert!(phases.record(
        r#"[mokly:postcss-phase] {"phase":"config-load","event":"end","elapsedMs":4,"durationMs":3}"#,
    ));
    assert!(phases.record(
        r#"[mokly:postcss-phase] {"phase":"stylesheet-run","event":"end","elapsedMs":8,"durationMs":2}"#,
    ));
    phases.reset_stylesheet();
    assert_eq!(
        phases.summary().as_deref(),
        Some(
            "PostCSS phases: spawn=not-started, config-load=complete 3ms, plugin-construction=not-started, stylesheet-run=not-started"
        ),
    );
}
