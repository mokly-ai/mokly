//! Deep module edges preserve stylesheet encounter order without recursive calls.

use std::collections::{BTreeMap, BTreeSet};
use std::thread;

#[test]
fn a_deep_import_chain_keeps_first_stylesheet_encounter_and_stops_cycles() {
    thread::spawn(|| {
        let mut modules = BTreeMap::new();
        for index in 0..100_000 {
            modules.insert(
                index.to_string(),
                vec![(index + 1).to_string(), "shared.css".into()],
            );
        }
        modules.insert("100000".into(), vec!["leaf.css".into(), "0".into()]);
        let mut files = Vec::new();
        super::visit("0", &modules, &mut BTreeSet::new(), &mut files);
        assert_eq!(files, ["leaf.css", "shared.css"]);
    })
    .join()
    .unwrap();
}
