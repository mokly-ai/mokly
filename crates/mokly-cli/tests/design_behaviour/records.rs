//! The test-only page exposes authored comparison records, independently of headings.

use serde_json::Value;

use super::catalogue::Catalogue;
use super::dom;

/// Decode the independently rendered authored records used by the behaviour checks.
pub(super) fn read(fixture: &Catalogue) -> Value {
    let records = fixture.views("behaviour-records");
    assert_eq!(records.len(), 1);
    let tree = &records[0].document.as_ref().unwrap().tree;
    let pre = dom::elements(tree)
        .into_iter()
        .find(|element| element.get("id") == Some("records"))
        .unwrap();
    serde_json::from_str(&dom::text(&pre.children)).unwrap()
}

/// A page in the temporary fixture exposes records without rendering their headings.
pub(super) const SOURCE: &str = r#"
import { definePage } from '@mokly/mokly';
import { componentComparison, actionComparison } from './design/components/parts/comparison_fixtures.js';
import { COMPONENT_PAGES, CONTROLS_PAGES, LIMIT_PAGES } from './design/components/parts/destinations.js';
import { SOLE_CHANGES } from './design/components/parts/navigation_tree.js';
const states = ['comparison', 'overlay', 'difference', 'overlay-tall', 'removed', 'style-changed'];
const headings = Object.fromEntries(states.map(state => [COMPONENT_PAGES[state], componentComparison(state)]));
headings[CONTROLS_PAGES.comparison] = actionComparison;
headings[LIMIT_PAGES.removed] = componentComparison('removed');
export default definePage({title:'Design behavior records',description:'',relatedDocs:[],render:()=>{
  const json=JSON.stringify({headings,checklist:SOLE_CHANGES.checklist});
  const escaped=json.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return '<!doctype html><html><head><title>Records</title></head><body><pre id="records">'+escaped+'</pre></body></html>';
}});
"#;
