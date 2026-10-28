//! A startup edit under a PostCSS directory dependency still reaches the served CSS.

use std::fs;
use std::path::Path;
use std::time::Duration;

use super::support::{Serve, get, write};

/// Each run reads `value.txt` and, when it exists, the file dependency `outside/extra.txt`.
/// Then it announces `waiting-<run>` and waits for `open-<run>`. Runs are counted with
/// existence checks, which add no read evidence.
fn plugin(directory: &str) -> String {
    format!(
        r#"import fs from 'node:fs';
import {{fileURLToPath}} from 'node:url';
const here = (name) => fileURLToPath(new URL('./' + name, import.meta.url));
export default {{plugins:[{{postcssPlugin:'gate',async Once(root,{{result}}) {{
  const dir = here('{directory}');
  result.messages.push({{type:'dir-dependency',plugin:'gate',dir,glob:'**/*.txt'}});
  const value = fs.readFileSync(dir + '/value.txt','utf8').trim();
  root.append({{selector:'.gate',nodes:[{{prop:'--gate',value}}]}});
  const extra = here('outside/extra.txt');
  if (fs.existsSync(extra)) {{
    result.messages.push({{type:'dependency',plugin:'gate',file:extra}});
    root.append({{selector:'.extra',nodes:[{{prop:'--extra',value:fs.readFileSync(extra,'utf8').trim()}}]}});
  }}
  let run = 1;
  while (fs.existsSync(here('waiting-' + run))) run += 1;
  fs.writeFileSync(here('waiting-' + run), '');
  while (!fs.existsSync(here('open-' + run))) await new Promise((resolve) => setTimeout(resolve, 10));
}}}}]}};
"#
    )
}

async fn start(directory: &'static str, extra: bool) -> Serve {
    Serve::configured("", &move |root: &Path, _: &Path| {
        fs::remove_file(root.join("specs/home.mockup.tsx")).unwrap();
        write(
            &root.join("specs/home.screen.html"),
            "---\ntitle: Home\n---\n<p class=gate>Home</p>",
        );
        write(&root.join("theme.css"), ".gate { color: red }");
        fs::create_dir_all(root.join(directory)).unwrap();
        write(&root.join(directory).join("value.txt"), "first");
        if extra {
            fs::create_dir_all(root.join("outside")).unwrap();
            write(&root.join("outside/extra.txt"), "early");
        }
        write(&root.join("postcss.mjs"), &plugin(directory));
        write(
            &root.join("mokly.config.json"),
            r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        );
    })
    .await
}

async fn waiting(serve: &Serve, run: usize) {
    let path = serve.path(&format!("waiting-{run}"));
    tokio::time::timeout(Duration::from_secs(30), async {
        while !path.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("PostCSS run {run} never started"));
}

fn open(serve: &Serve, run: usize) {
    write(&serve.path(&format!("open-{run}")), "");
}

async fn stylesheet(serve: &Serve) -> String {
    get(&serve.host, "/static/mokly-generated/styles/theme.css").await
}

fn listening(serve: &Serve) -> bool {
    serve
        .lines
        .lock()
        .unwrap()
        .iter()
        .any(|line| line.contains("http://"))
}

#[tokio::test]
async fn an_edit_in_an_observed_directory_during_startup_rebuilds_after_readiness() {
    let directory = "specs/content";
    let mut serve = start(directory, false).await;
    waiting(&serve, 1).await;
    write(&serve.path(directory).join("value.txt"), "second");
    open(&serve, 1);
    serve.listening().await;
    let ready = stylesheet(&serve).await;
    assert!(ready.contains("first"), "{ready}");
    assert!(!ready.contains("second"), "{ready}");
    waiting(&serve, 2).await;
    open(&serve, 2);
    tokio::time::timeout(Duration::from_secs(30), async {
        while !stylesheet(&serve).await.contains("second") {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    serve.stop().await;
}

#[tokio::test]
async fn an_edit_in_an_unobserved_directory_during_startup_prepares_again_before_readiness() {
    let directory = "content";
    let mut serve = start(directory, false).await;
    waiting(&serve, 1).await;
    write(&serve.path(directory).join("value.txt"), "second");
    open(&serve, 1);
    waiting(&serve, 2).await;
    assert!(!listening(&serve));
    open(&serve, 2);
    serve.listening().await;
    let ready = stylesheet(&serve).await;
    assert!(ready.contains("second"), "{ready}");
    serve.stop().await;
}

#[tokio::test]
async fn an_edit_to_an_unobserved_exact_file_during_startup_rebuilds_after_readiness() {
    let mut serve = start("specs/content", true).await;
    waiting(&serve, 1).await;
    write(&serve.path("outside/extra.txt"), "late");
    open(&serve, 1);
    serve.listening().await;
    let ready = stylesheet(&serve).await;
    assert!(ready.contains("early"), "{ready}");
    assert!(!ready.contains("late"), "{ready}");
    waiting(&serve, 2).await;
    open(&serve, 2);
    tokio::time::timeout(Duration::from_secs(30), async {
        while !stylesheet(&serve).await.contains("late") {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    serve.stop().await;
}
