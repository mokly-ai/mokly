//! Owned registry proof joins complete catalogue matches across delivery paths.

use std::fs;

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::ReviewState;

use super::base_styles_tests::{compare, consumer};
use super::support::Consumer;

const SCHEMA: &str =
    "propSchema:{type:'object',properties:{},additionalProperties:false},props:{},";

fn write(consumer: &Consumer, file: &str, source: &str) {
    fs::write(consumer.root().join("owned").join(file), source).unwrap();
}

fn fixture(color: &str, case: &str) -> Consumer {
    let consumer = consumer("'black'");
    let child = format!(
        "import {{defineComponent}} from '@mokly/mokly';
        import {{createGlobalStyle}} from 'styled-components';
        const Styles=createGlobalStyle`.child{{color:{color}}}`;
        export const child=defineComponent({{title:'Child',description:'',relatedDocs:[],element:'ui-child',
        {SCHEMA} slots:['children'],render:props=><><STYLE/><section className='child'>{{props.children}}</section></>}});"
    )
    .replace("<STYLE/>", if case == "child" { "<Styles/>" } else { "" });
    write(&consumer, "child.mockup.tsx", &child);
    let (selector, body) = match case {
        "slot" => (
            ".slot",
            "<child.Component><h1 className='slot'>Supplier</h1></child.Component>",
        ),
        "element" => (".child", "<child.Component/>"),
        "self" => (".leaf", "<card.Component outer={false}/>"),
        "unused" => (".unused", "<p>Unrelated</p>"),
        _ => (".unused", "<child.Component/>"),
    };
    let schema = if case == "self" {
        "propSchema:{type:'object',properties:{outer:{type:'boolean'}},required:['outer'],additionalProperties:false},props:{outer:true},"
    } else {
        SCHEMA
    };
    let render = if case == "self" {
        format!(
            "props=>props.outer ? <main>{body}</main> : <><Styles/><p className='leaf'>Leaf</p></>"
        )
    } else {
        format!("()=> <><Styles/>{body}</>")
    };
    let own_color = if case == "child" { "black" } else { color };
    write(&consumer, "card.mockup.tsx", &format!(
        "import {{defineComponent}} from '@mokly/mokly';
        import {{createGlobalStyle}} from 'styled-components';
        import {{child}} from './child.mockup';
        const Styles=createGlobalStyle`{selector}{{color:{own_color}}}`;
        export const card=defineComponent({{title:'Card',description:'',relatedDocs:[],element:'ui-card',{schema}render:{render}}});"
    ));
    let html_props = if case == "self" {
        " outer=\"true\""
    } else {
        ""
    };
    let react_props = if case == "self" { " outer={true}" } else { "" };
    write(
        &consumer,
        "home.screen.html",
        &format!("---\ntitle: Home\n---\n<ui-card{html_props}></ui-card>"),
    );
    write(&consumer, "whole.mockup.tsx", &format!(
        "import {{defineScreen}} from '@mokly/mokly'; import {{card}} from './card.mockup';
        export const whole=defineScreen({{title:'Whole',description:'',relatedDocs:[],render:()=> <card.Component{react_props}/>}});"
    ));
    consumer
}

fn check(case: &str, changed: &str, consumers: &[&str]) {
    let base = fixture("red", case);
    let head = fixture("blue", case);
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, [changed]);
    let mut affected: Vec<_> = result
        .review
        .affected
        .iter()
        .map(|row| row.consumer.path.as_str())
        .collect();
    affected.sort();
    assert_eq!(affected, consumers);
    for entry in &result.entries {
        for view in &entry.documents {
            assert_eq!(
                view.state,
                if entry.path == changed {
                    ReviewState::Changed
                } else {
                    ReviewState::Unchanged
                },
                "{}",
                entry.path
            );
            if entry.path == changed || consumers.contains(&entry.path.as_str()) {
                assert_eq!(view.evidence.rules.len(), 1, "{}", entry.path);
                assert_eq!(view.evidence.rules[0].status, RuleStatus::Matched);
                assert_eq!(
                    view.evidence.rules[0].owner,
                    EvidenceOwner::Component {
                        path: changed.into()
                    }
                );
            }
        }
    }
}

#[test]
fn child_registry_edits_leave_component_and_whole_screen_consumers_affected() {
    check("child", "child", &["card", "home", "whole"]);
}

#[test]
fn owned_slot_content_keeps_the_supplier_component_match() {
    check("slot", "card", &["home", "whole"]);
}

#[test]
fn owned_child_element_rules_keep_the_consumer_match_without_child_own_proof() {
    check("element", "card", &["home", "whole"]);
}

#[test]
fn owned_self_nested_rules_keep_the_component_own_view_match() {
    check("self", "card", &["home", "whole"]);
}

#[test]
fn unused_registry_rules_get_one_excluded_document_record() {
    let result = compare(&fixture("red", "unused"), &fixture("blue", "unused"));
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.review.affected.is_empty());
    for entry in result.entries.iter().filter(|entry| entry.path != "child") {
        for view in &entry.documents {
            assert_eq!(view.evidence.rules.len(), 1, "{}", entry.path);
            let rule = &view.evidence.rules[0];
            assert_eq!(rule.status, RuleStatus::Excluded);
            assert_eq!(rule.owner, EvidenceOwner::Entry);
            assert!(rule.selector.is_empty());
            assert_eq!(
                rule.stylesheet,
                format!(
                    "static/mokly-generated/{}",
                    view.after_route.as_ref().unwrap()
                )
            );
        }
    }
}

#[test]
fn forwarded_slots_keep_the_exact_supplier_through_a_repeated_component() {
    let base = consumer("'black'");
    let head = consumer("'black'");
    for (consumer, color) in [(&base, "red"), (&head, "blue")] {
        write(
            consumer,
            "styles.tsx",
            &format!(
                "import {{createGlobalStyle}} from 'styled-components'; export const Styles=createGlobalStyle`.slot{{color:{color}}}`;"
            ),
        );
        write(consumer, "parent.mockup.tsx", "import {defineComponent} from '@mokly/mokly';
            import {child} from './child.mockup'; import {Styles} from './styles';
            export const parent=defineComponent({title:'Parent',description:'',relatedDocs:[],element:'ui-parent',
            propSchema:{type:'object',additionalProperties:false,required:['outer'],properties:{outer:{type:'boolean'}}},
            props:{outer:false},slots:['children'],render:props=>props.outer ?
            <><Styles/><child.Component><span className='slot'>Supplier</span></child.Component></> :
            <section>{props.children ?? <p>Empty</p>}</section>});");
        write(consumer, "child.mockup.tsx", &format!("import {{defineComponent}} from '@mokly/mokly';
            import {{parent}} from './parent.mockup'; import {{Styles}} from './styles';
            export const child=defineComponent({{title:'Child',description:'',relatedDocs:[],element:'ui-child',
            {SCHEMA}slots:['children'],render:props=><><Styles/><p className='slot'>Child own</p>
            <parent.Component outer={{false}}>{{props.children}}</parent.Component></>}});"));
        write(
            consumer,
            "home.screen.html",
            "---\ntitle: Home\n---\n<ui-parent outer=\"true\"></ui-parent>",
        );
        write(consumer, "whole.mockup.tsx", "import {defineScreen} from '@mokly/mokly';
            import {parent} from './parent.mockup';
            export const whole=defineScreen({title:'Whole',description:'',relatedDocs:[],render:()=> <parent.Component outer={true}/>});");
    }
    let result = compare(&base, &head);
    assert_eq!(result.snapshot.changed_entries, ["child", "parent"]);
    let entry = |path: &str| {
        result
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .unwrap()
    };
    for view in &entry("home").documents {
        assert_eq!(view.state, ReviewState::Unchanged);
        let owners: Vec<_> = view
            .evidence
            .rules
            .iter()
            .map(|rule| rule.owner.clone())
            .collect();
        assert_eq!(
            owners,
            [
                EvidenceOwner::Component {
                    path: "child".into()
                },
                EvidenceOwner::Component {
                    path: "parent".into()
                }
            ]
        );
    }
    for view in &entry("whole").documents {
        assert_eq!(view.state, ReviewState::Unchanged);
        assert!(view.evidence.rules.iter().all(|rule| rule.owner
            == EvidenceOwner::Component {
                path: "child".into()
            }));
    }
}
