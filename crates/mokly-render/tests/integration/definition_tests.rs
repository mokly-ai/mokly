//! Every definition kind and imported reference uses the resolved handle table.

use std::fs;

use mokly_model::catalogue::EntryContent;

use super::support::Consumer;

#[test]
fn imported_screen_references_use_cases_pages_and_root_folders_resolve_together() {
    let consumer = Consumer::new();
    consumer.replace(
        "specs/screen.mockup.tsx",
        "title: \"React screen\",",
        "title: \"React screen\", useCasePaths: ['flow'],",
    );
    fs::write(consumer.root().join("specs/group.mockup.ts"), r#"
import { defineFolder, definePage, defineUseCase } from '@mokly/mokly';
import screen from './screen.mockup.js';
export const flow = defineUseCase({slug:'flow',title:'Flow',description:'',relatedDocs:[],steps:[{screenPath:screen}]});
export const folder = defineFolder({path:'',title:'Fixture catalogue'});
export const guide = definePage({slug:'guide',title:'Guide',description:'',relatedDocs:[],render:()=> '<!doctype html><html><head><title>Guide</title></head><body>Guide</body></html>'});
export const fixtures = [[{name:'plain data'}], 42];
"#).unwrap();
    let prepared = consumer.prepare().unwrap();
    let flow = prepared
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "flow")
        .unwrap();
    let EntryContent::UseCase { steps } = &flow.content else {
        panic!("flow")
    };
    assert_eq!(steps[0].screen_path, "screen");
    assert!(prepared.model.folders.iter().any(
        |folder| folder.path.is_empty() && folder.title.as_deref() == Some("Fixture catalogue")
    ));
    assert_eq!(
        prepared.javascript.bindings["specs/group.mockup.ts#folder"].path,
        ""
    );
    let generation = consumer.generation(prepared);
    assert!(
        String::from_utf8(generation.render("guide/index.html").unwrap().bytes.clone())
            .unwrap()
            .contains("Guide")
    );
}
