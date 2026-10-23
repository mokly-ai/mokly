//! Nested instance evidence does not invent own-preview states or dependency sources.

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{EntryChangeReason, ReviewState};

mod changes_support;
#[expect(dead_code, reason = "These cases use the configured build helper.")]
mod containment_support;

fn sources(margin: u8, padding: u8) -> Vec<(String, String)> {
    vec![
        ("x.mockup.tsx".into(), r#"import {defineComponent} from '@mokly/mokly';
import {Styles} from './styles'; import {y} from './y.mockup';
export const x=defineComponent({title:'X',description:'',relatedDocs:[],element:'ui-x',
propSchema:{type:'object',additionalProperties:false,required:['outer'],properties:{outer:{type:'boolean'}}},
props:{outer:true},render:props=>props.outer ? <><p className='own'>X own</p><y.Component direct={false}/></> : <><Styles/><span className='hit'>X leaf</span></>});"#.into()),
        ("y.mockup.tsx".into(), r#"import {defineComponent} from '@mokly/mokly';
import {Styles} from './styles'; import {x} from './x.mockup';
export const y=defineComponent({title:'Y',description:'',relatedDocs:[],element:'ui-y',
propSchema:{type:'object',additionalProperties:false,required:['direct'],properties:{direct:{type:'boolean'}}},
props:{direct:true},render:props=>props.direct ? <><Styles/><p className='hit'>Y own</p></> : <x.Component outer={false}/>});"#.into()),
        ("home.screen.html".into(), "---\ntitle: Home\n---\n<ui-x outer='true'></ui-x>".into()),
        ("styles.tsx".into(), format!("import {{createGlobalStyle}} from 'styled-components'; export const Styles=createGlobalStyle`.hit{{margin-left:{margin}px}}`;")),
        ("own.css".into(), format!(".own{{padding-left:{padding}px}}")),
    ]
}

fn check(mixed: bool) {
    let review = containment_support::build_configured(
        sources(1, 1),
        sources(2, if mixed { 2 } else { 1 }),
        r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["specs/own.css"]}]}"#,
    );
    let x = review
        .entries
        .iter()
        .find(|entry| entry.path == "x")
        .unwrap();
    assert!(x.included);
    assert!(x.reasons.contains(&EntryChangeReason::Implementation));
    let dependencies: Vec<_> = x
        .reasons
        .iter()
        .filter_map(|reason| {
            if let EntryChangeReason::Dependency { path } = reason {
                Some(path.as_str())
            } else {
                None
            }
        })
        .collect();
    assert_eq!(
        dependencies,
        if mixed {
            vec!["static/mokly-generated/styles/specs/own.css"]
        } else {
            vec![]
        }
    );
    for view in &x.views {
        assert_eq!(
            view.state,
            if mixed {
                ReviewState::Changed
            } else {
                ReviewState::Unchanged
            }
        );
        assert!(view.rules.iter().any(|rule| rule.selector == ".hit"
            && rule.status == RuleStatus::Matched
            && rule.owner == EvidenceOwner::Component { path: "x".into() }));
    }
    let home = review
        .entries
        .iter()
        .find(|entry| entry.path == "home")
        .unwrap();
    assert!(!home.included);
    assert!(
        home.views
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
    assert!(
        review
            .affected
            .iter()
            .any(|row| row.changed_component_id == "x" && row.consumer.path == "home")
    );
}

#[test]
fn a_nested_copy_keeps_details_and_instance_proof_without_changing_own_previews() {
    check(false);
}

#[test]
fn a_kept_own_source_does_not_promote_a_nested_only_source_to_a_dependency() {
    check(true);
}
