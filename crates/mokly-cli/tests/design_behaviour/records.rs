//! The test-only page exposes authored comparison records, independently of captions.

/// A page in the temporary fixture exposes records without rendering their captions.
pub(super) const SOURCE: &str = r#"
import { definePage } from '@mokly/mokly';
import { componentComparison, actionComparison } from './design/components/parts/comparison_fixtures.js';
import { COMPONENT_PAGES, CONTROLS_PAGES, LIMIT_PAGES } from './design/components/parts/destinations.js';
import { SOLE_CHANGES } from './design/components/parts/navigation_tree.js';
const states = ['comparison', 'overlay', 'difference', 'overlay-tall', 'removed', 'style-changed'];
const captions = Object.fromEntries(states.map(state => [COMPONENT_PAGES[state], componentComparison(state)]));
captions[CONTROLS_PAGES.comparison] = actionComparison;
captions[LIMIT_PAGES.removed] = componentComparison('removed');
export default definePage({title:'Design behavior records',description:'',relatedDocs:[],render:()=>{
  const json=JSON.stringify({captions,checklist:SOLE_CHANGES.checklist});
  const escaped=json.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return '<!doctype html><html><head><title>Records</title></head><body><pre id="records">'+escaped+'</pre></body></html>';
}});
"#;
