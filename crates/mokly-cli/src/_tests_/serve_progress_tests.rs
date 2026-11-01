//! Progress ticks use fake time and one owner serializes both terminal streams.

use std::future::{Future, poll_fn};
use std::pin::Pin;
use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;

use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_compare::comparison_steps::Step;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use tokio::sync::{mpsc, watch};
use unimock::{MockFn, Unimock, matching};

use crate::phase_format::frame;
use crate::serve_progress::{Progress, ServeProgress};
use crate::terminal::{Terminal, TerminalMock};

fn terminal() -> (
    Arc<dyn Terminal>,
    mpsc::UnboundedReceiver<(&'static str, String)>,
) {
    let (send, receive) = mpsc::unbounded_channel();
    let output = send.clone();
    let terminal = Unimock::new((
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                output.send(("out", text.into())).unwrap();
            })),
        TerminalMock::stderr
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                send.send(("err", text.into())).unwrap();
            })),
    ));
    (Arc::new(terminal), receive)
}

#[tokio::test(start_paused = true)]
async fn ticks_erase_events_and_old_leases_cannot_clear_a_replacement() {
    let (terminal, mut lines) = terminal();
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 80,
    };
    let progress = Arc::new(ServeProgress::new(
        style.clone(),
        terminal,
        Arc::new(ServeCancellation::default()),
        true,
    ));
    let first = progress.begin("Comparing with base", Arc::new(ChangeToken::default()));
    assert_eq!(
        lines.recv().await.unwrap(),
        ("out", frame(&style, "Comparing with base", 0))
    );
    let (stop, stopped) = watch::channel(false);
    let mut animate = progress.animate(stopped);
    poll_pending(animate.as_mut()).await;
    tokio::time::advance(Duration::from_millis(79)).await;
    poll_pending(animate.as_mut()).await;
    assert!(lines.try_recv().is_err());
    tokio::time::advance(Duration::from_millis(1)).await;
    poll_pending(animate.as_mut()).await;
    assert_eq!(
        lines.recv().await.unwrap(),
        ("out", frame(&style, "Comparing with base", 1))
    );
    progress.stderr("diagnostic\n");
    assert_eq!(lines.recv().await.unwrap(), ("out", "\r\x1b[2K".into()));
    assert_eq!(lines.recv().await.unwrap(), ("err", "diagnostic\n".into()));
    let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let second = progress.begin("Comparing with next", cancel.clone());
    assert_eq!(lines.recv().await.unwrap().1, "\r\x1b[2K");
    assert_eq!(
        lines.recv().await.unwrap().1,
        frame(&style, "Comparing with next", 0)
    );
    first.finish();
    assert!(lines.try_recv().is_err());
    cancel.cancel();
    tokio::time::advance(Duration::from_millis(80)).await;
    poll_pending(animate.as_mut()).await;
    assert_eq!(lines.recv().await.unwrap().1, "\r\x1b[2K");
    second.finish();
    stop.send_replace(true);
    animate.await;
    assert!(lines.try_recv().is_err());
}

#[tokio::test]
async fn pipes_keep_start_lines_plain_mode_is_silent_and_cancellation_suppresses_start() {
    for mode in [Mode::Plain, Mode::Rich] {
        let (terminal, mut lines) = terminal();
        let cancellation: Arc<dyn Cancellation> = Arc::new(ServeCancellation::default());
        let progress = ServeProgress::new(
            Style {
                mode,
                color: false,
                ascii: false,
                columns: 80,
            },
            terminal,
            cancellation.clone(),
            false,
        );
        let token: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        let phase = progress.begin("Comparing with base", token.clone());
        if mode == Mode::Rich {
            assert_eq!(lines.recv().await.unwrap().1, "  Comparing with base…\n");
        }
        progress.step(&token, Step::Installing);
        assert!(lines.try_recv().is_err());
        progress.stdout("ready\n");
        progress.stderr("warning\n");
        assert_eq!(lines.recv().await.unwrap(), ("out", "ready\n".into()));
        assert_eq!(lines.recv().await.unwrap(), ("err", "warning\n".into()));
        phase.finish();
        cancellation.interrupt();
        let _cancelled = progress.begin("Must stay silent", Arc::new(ChangeToken::default()));
        assert!(lines.try_recv().is_err());
    }
}

#[tokio::test(start_paused = true)]
async fn steps_relabel_only_the_live_phase_that_their_comparison_began() {
    let (send, mut lines) = mpsc::unbounded_channel();
    let terminal = Arc::new(Unimock::new(
        TerminalMock::stdout
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, text| {
                send.send(text.to_owned()).unwrap();
            })),
    ));
    let progress = Arc::new(ServeProgress::new(
        Style {
            mode: Mode::Rich,
            color: false,
            ascii: true,
            columns: 80,
        },
        terminal,
        Arc::new(ServeCancellation::default()),
        true,
    ));
    let first: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let other: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let _first = progress.begin("Comparing with base", first.clone());
    assert_eq!(
        lines.recv().await.unwrap(),
        "\r\x1b[2K  | Comparing with base"
    );
    progress.step(&first, Step::Installing);
    assert_eq!(
        lines.recv().await.unwrap(),
        "\r\x1b[2K  | Comparing with base · installing base dependencies"
    );
    progress.step(&other, Step::Rendering);
    assert!(lines.try_recv().is_err());
    let (stop, stopped) = watch::channel(false);
    let mut animate = progress.animate(stopped);
    poll_pending(animate.as_mut()).await;
    tokio::time::advance(Duration::from_millis(80)).await;
    poll_pending(animate.as_mut()).await;
    assert_eq!(
        lines.recv().await.unwrap(),
        "\r\x1b[2K  / Comparing with base · installing base dependencies"
    );
    let _next = progress.begin("Comparing with next", other.clone());
    assert_eq!(lines.recv().await.unwrap(), "\r\x1b[2K");
    assert_eq!(
        lines.recv().await.unwrap(),
        "\r\x1b[2K  | Comparing with next"
    );
    progress.step(&first, Step::Comparing);
    other.cancel();
    progress.step(&other, Step::Comparing);
    assert!(lines.try_recv().is_err());
    stop.send_replace(true);
    animate.await;
}

async fn poll_pending(mut future: Pin<&mut (dyn Future<Output = ()> + Send)>) {
    poll_fn(|context| {
        assert!(future.as_mut().poll(context).is_pending());
        Poll::Ready(())
    })
    .await;
}
