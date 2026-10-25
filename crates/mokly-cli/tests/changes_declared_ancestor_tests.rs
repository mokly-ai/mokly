//! An outer supplier's rule proof does not remove a receiver's declared claim.

use std::collections::BTreeSet;

use mokly_model::evidence::EvidenceOwner;
use mokly_model::review::ReviewState;

mod changes_support;
#[expect(dead_code, reason = "this case uses the configured build entry point")]
mod containment_support;

fn sources(margin: u8) -> Vec<(String, String)> {
    vec![
        ("receiver.mockup.tsx".into(), format!("import {{defineComponent}} from '@mokly/mokly'; import {{createGlobalStyle}} from 'styled-components'; const Styles=createGlobalStyle`.hit{{margin-left:{margin}px}}`; export const receiver=defineComponent({{title:'Receiver',description:'',relatedDocs:[],element:'ui-receiver',propSchema:{{type:'object',properties:{{}},additionalProperties:false}},props:{{}},slots:['children'],render:props=><><Styles/><section>{{props.children ?? <p>No hit</p>}}</section></>}});")),
        ("supplier.component.html".into(), "---\ntitle: Supplier\nelement: ui-supplier\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<article><p class='hit'>Supplier own</p><ui-receiver><span class='hit'>Supplied</span></ui-receiver></article>".into()),
        ("home.screen.html".into(),"---\ntitle: Home\n---\n<ui-supplier></ui-supplier>".into()),
        ("styles.css".into(),format!(".hit{{margin-left:{margin}px}}")),
    ]
}

#[test]
fn declared_receiver_claims_do_not_depend_on_outer_supplier_context() {
    let config = r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["specs/styles.css"]}]}"#;
    let review = containment_support::build_configured(sources(1), sources(2), config);
    for path in ["supplier", "home"] {
        let entry = review
            .entries
            .iter()
            .find(|entry| entry.path == path)
            .unwrap();
        for view in &entry.views {
            let owners: BTreeSet<_> = view
                .rules
                .iter()
                .filter(|rule| rule.stylesheet.ends_with(".html"))
                .map(|rule| match &rule.owner {
                    EvidenceOwner::Component { path } => path.as_str(),
                    EvidenceOwner::Entry => "entry",
                })
                .collect();
            assert_eq!(owners, BTreeSet::from(["receiver", "supplier"]), "{path}");
            if path == "home" {
                assert_eq!(view.state, ReviewState::Unchanged);
            }
        }
    }
}
