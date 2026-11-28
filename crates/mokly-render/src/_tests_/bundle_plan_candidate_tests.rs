//! Edit plan admission uses its typed directory reader and preserves other inputs.

use std::collections::BTreeMap;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_sidecar::compiled::PhysicalInput;
use mokly_sidecar::methods::BundleCapture;
use mokly_sidecar::resolution_plan::DirectoryCandidates;
use mokly_sidecar::storybook::{PreviewModule, PreviewSelection};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::{request, stamp};
use crate::physical_inputs::PhysicalInputsMock;

use super::bundle_plan_support::{evidence, marked, params, plan, result, runtime};

#[test]
fn edit_plan_directories_use_candidates_while_missing_selectors_keep_whole_checks() {
    let current = Arc::new(AtomicBool::new(true));
    let reads = current.clone();
    let physical = Unimock::new((
        PhysicalInputsMock::matches
            .each_call(matching!((path, _) if *path == Path::new("/physical/config.json")))
            .answers(&|_, _, _| Ok(true)),
        PhysicalInputsMock::matches_candidates
            .each_call(
                matching!((path, expected, names) if *path == Path::new("/physical")
                && matches!(expected, PhysicalInput::Directory { entries } if entries.is_empty())
                && *names == ["value.ts"]),
            )
            .answers_arc(Arc::new(
                move |_, _, _, _| Ok(reads.load(Ordering::Acquire)),
            )),
    ));
    let mut evidence = evidence();
    Arc::make_mut(&mut evidence).inputs.insert(
        "/physical".into(),
        PhysicalInput::Directory { entries: vec![] },
    );
    let mut plan = plan();
    let data = Arc::make_mut(&mut plan);
    data.paths.push("/physical".into());
    data.candidates = Some(vec![DirectoryCandidates(2, vec!["value.ts".into()])]);
    let calls = Arc::new(Mutex::new(vec![]));
    let mut runtime = runtime(
        physical,
        vec![result(Some(plan.clone()), evidence)],
        calls.clone(),
    )
    .with_serve_edit_plans();
    let _ = request(&runtime, &params(), None).unwrap();
    runtime.bundle_capture = BundleCapture::ServeEdit;
    for expected in [true, false] {
        current.store(expected, Ordering::Release);
        let _ = request(&runtime, &params(), None).unwrap();
        assert_eq!(
            calls.lock().unwrap().last().unwrap().plan,
            expected.then(|| plan.clone())
        );
    }
}

#[test]
fn serve_edit_bundle_stamp_rejects_added_previews_and_retargeted_links() {
    let repository = Path::new("/repo");
    let earlier = ".storybook/preview.js";
    let selected = ".storybook/preview.ts";
    let first = "first/preview.ts";
    let second = "second/preview.ts";
    let mut reply = marked();
    let compiled = Arc::make_mut(&mut reply.compiled);
    compiled.storybook_previews.insert(
        ".storybook".into(),
        PreviewSelection {
            selected: Some(PreviewModule {
                path: selected.into(),
                file: first.into(),
            }),
            absent: vec![earlier.into()],
        },
    );
    compiled.metadata_inputs = BTreeMap::from([
        (earlier.into(), None),
        (selected.into(), Some("same preview bytes".into())),
    ]);
    let stamp = stamp(&reply, repository);
    let scenario = Arc::new(Mutex::new((false, first)));
    let projected = scenario.clone();
    let digested = scenario.clone();
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let (added, target) = *projected.lock().unwrap();
                let selection = if path == repository.join(selected) {
                    Some((target, FileKind::Symlink))
                } else {
                    added.then_some((earlier, FileKind::File))
                };
                Ok(selection.map(|(file, lexical_kind)| Node {
                    identity: repository.join(file),
                    lexical_kind,
                    kind: FileKind::File,
                }))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if path == repository.join(earlier) && !digested.lock().unwrap().0 {
                    Err(SourceError::Io {
                        operation: "digest",
                        path: path.into(),
                        source: io::ErrorKind::NotFound.into(),
                    })
                } else {
                    Ok("same preview bytes".into())
                }
            })),
    ));
    for (added, target, expected) in [
        (false, first, true),
        (true, first, false),
        (false, second, false),
    ] {
        *scenario.lock().unwrap() = (added, target);
        assert_eq!(stamp.matches(&tree), expected, "{added} {target}");
    }
}
