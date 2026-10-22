//! Component and screen parents for decision 110, shared by CLI and render checks.

#[derive(Clone, Copy, Debug)]
pub enum Edit {
    Stack,
    Supplier,
    ButtonAndStack,
}

pub fn sources(emotion: bool, edit: Edit, changed: bool) -> Vec<(String, String)> {
    let button = if changed && matches!(edit, Edit::ButtonAndStack) {
        "blue"
    } else {
        "red"
    };
    let spacing = if changed && matches!(edit, Edit::Stack | Edit::ButtonAndStack) {
        16
    } else {
        8
    };
    let border = if changed && matches!(edit, Edit::Supplier) {
        "blue"
    } else {
        "red"
    };
    let component = |name: &str, rule: &str, body: &str, imports: &str, slots: bool| {
        let styles = if emotion {
            format!(
                "import {{Global,css}} from '@emotion/react'; const rules=css`{rule}`; const Styles=()=> <Global styles={{rules}}/>;"
            )
        } else {
            format!(
                "import {{createGlobalStyle}} from 'styled-components'; const Styles=createGlobalStyle`{rule}`;"
            )
        };
        format!(
            "import {{defineComponent}} from '@mokly/mokly'; {imports} {styles} export const {name}=defineComponent({{title:'{name}',description:'',relatedDocs:[],element:'ui-{name}',propSchema:{{type:'object',properties:{{}},additionalProperties:false}},props:{{}},slots:{},render:props=> <><Styles/>{body}</>}});",
            if slots { "['children']" } else { "[]" }
        )
    };
    vec![
        ("button.mockup.tsx".into(), component("button", &format!(".button{{color:{button}}}"), "<button className='button'>Go</button>", "", false)),
        ("card.mockup.tsx".into(), component("card", ".card .button{margin-left:4px}", "<article className='card'><button.Component/></article>", "import {button} from './button.mockup';", false)),
        ("stack.mockup.tsx".into(), component("stack", &format!(".stack > * + *{{margin-top:{spacing}px}}"), "<div className='stack'>{props.children}</div>", "", true)),
        ("layout.mockup.tsx".into(), component("layout", &format!(".layout .card{{border:1px solid {border}}}"), "<section className='layout'><stack.Component><card.Component moklyInstance='a'/><card.Component moklyInstance='b'/></stack.Component></section>", "import {stack} from './stack.mockup'; import {card} from './card.mockup';", false)),
        ("home.screen.html".into(), "---\ntitle: Home\n---\n<ui-layout></ui-layout>".into()),
        ("whole.mockup.tsx".into(), "import {defineScreen} from '@mokly/mokly'; import {layout} from './layout.mockup'; export const whole=defineScreen({title:'Whole',description:'',relatedDocs:[],render:()=> <layout.Component/>});".into()),
        ("page.mockup.tsx".into(), "import {defineScreen} from '@mokly/mokly'; import {stack} from './stack.mockup'; import {card} from './card.mockup'; export const page=defineScreen({title:'Page',description:'',relatedDocs:[],render:()=> <stack.Component><card.Component moklyInstance='a'/><card.Component moklyInstance='b'/></stack.Component>});".into()),
    ]
}
