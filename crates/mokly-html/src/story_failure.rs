//! Package-owned error documents for saved Storybook views.

use mokly_catalogue::diagnostic::{STORY_RENDER_FAILED, Warning, WarningSubject, json_quoted};
use mokly_model::routes;
use mokly_model::usage::CatalogueUsage;

use crate::composition::{ComposeRequest, Composed};
use crate::error::Result;
use crate::fragment::{OwnedStyle, StoryRenderFailure};
use crate::tree::{Node, element};
use crate::{assembly, component_root, regions};

const STYLE: &str = r#"
.mokly-story-error {
  background: Canvas;
  color: CanvasText;
  font: 14px/1.45 system-ui, sans-serif;
  inset: 0;
  padding: 20px 24px;
  position: absolute;
}
.mokly-story-error > p {
  margin: 0 0 8px;
}
.mokly-story-error-title {
  font-size: 15px;
  font-weight: 600;
}
.mokly-story-error > .mokly-story-error-label {
  color: GrayText;
  font-size: 12px;
  margin-top: 14px;
}
.mokly-story-error code {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.mokly-story-error-reason {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
"#;

pub(crate) fn compose(
    request: &ComposeRequest<'_>,
    parent: &str,
    failure: &StoryRenderFailure,
) -> Result<Composed> {
    let mut body = component_root::attach(Vec::new(), parent)?;
    body.push(contents(failure));
    let mut tree = assembly::document(
        &request.entry.metadata.title,
        request.color_scheme,
        &[OwnedStyle {
            css: STYLE.into(),
            owners: Vec::new(),
            attribution: None,
        }],
        &[],
        body,
    );
    let ranges = regions::number(&mut tree);
    let route = routes::view(
        &request.entry.metadata.path,
        request.viewport,
        request.color_scheme,
    );
    let reason = failure
        .reason
        .replace("\r\n", "\n")
        .replace(['\n', '\r', '\u{0085}', '\u{2028}', '\u{2029}'], " ");
    Ok(Composed {
        tree,
        usage: CatalogueUsage::Ready {
            instances: Vec::new(),
            slots: Vec::new(),
            ranges,
        },
        warnings: vec![Warning {
            code: STORY_RENDER_FAILED,
            subject: WarningSubject::Route(route),
            message: format!(
                "story {} could not render; add the \"!mokly\" tag to leave it out: {reason}",
                json_quoted(&failure.story_id)
            ),
        }],
        resources: Vec::new(),
        components: vec![parent.into()],
        links: Vec::new(),
    })
}

fn contents(failure: &StoryRenderFailure) -> Node {
    element(
        "div",
        &[("class", "mokly-story-error")],
        vec![
            element(
                "p",
                &[("class", "mokly-story-error-title")],
                vec![Node::Text(format!(
                    "The {} story couldn’t render",
                    failure.name
                ))],
            ),
            element(
                "p",
                &[],
                vec![
                    Node::Text("Add the ".into()),
                    element("code", &[], vec![Node::Text("!mokly".into())]),
                    Node::Text(" tag to this story to leave it out of the catalogue.".into()),
                ],
            ),
            element(
                "p",
                &[("class", "mokly-story-error-label")],
                vec![Node::Text("Reason".into())],
            ),
            element(
                "code",
                &[("class", "mokly-story-error-reason")],
                vec![Node::Text(failure.reason.clone())],
            ),
        ],
    )
}
