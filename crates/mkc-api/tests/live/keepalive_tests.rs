//! Server ping and pong deadlines on an explicit clock.

use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};

use futures_util::SinkExt;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::TcpStream;
use tokio_tungstenite::client_async;
use tungstenite::Message;

use super::fixtures::{MEMBER_TOKEN, ORIGIN, PUBLIC};
use super::harness::{Harness, assert_notice, receive};
use super::route_tests::close_code;

#[tokio::test]
async fn two_pings_precede_the_close_of_a_silent_client() {
    let Some(app) = Harness::start() else {
        return;
    };
    let stream = SilentStream {
        tcp: TcpStream::connect(app.address).await.unwrap(),
        silent: false,
    };
    let request = app.request(&PUBLIC.to_string(), ORIGIN, Some(MEMBER_TOKEN));
    let (mut socket, response) = client_async(request, stream).await.unwrap();
    assert_eq!(response.status(), 101);
    socket.get_mut().silent = true;
    app.notice(PUBLIC);
    assert_notice(&mut socket).await;

    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    app.clock.advance(10);
    assert_eq!(close_code(receive(&mut socket).await), 4408);
}

#[tokio::test]
async fn a_pong_extends_the_deadline() {
    let Some(app) = Harness::start() else {
        return;
    };
    let mut socket = app.open(PUBLIC, MEMBER_TOKEN).await;
    app.notice(PUBLIC);
    assert_notice(&mut socket).await;

    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    socket
        .send(Message::Ping(b"probe".as_slice().into()))
        .await
        .unwrap();
    assert_eq!(
        receive(&mut socket).await,
        Message::Pong(b"probe".as_slice().into())
    );
    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
}

/// Stop client writes after the upgrade so Tungstenite's automatic pong stays local.
struct SilentStream {
    tcp: TcpStream,
    silent: bool,
}

impl AsyncRead for SilentStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.tcp).poll_read(cx, buf)
    }
}

impl AsyncWrite for SilentStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        if self.silent {
            return Poll::Ready(Ok(buf.len()));
        }
        Pin::new(&mut self.tcp).poll_write(cx, buf)
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.tcp).poll_flush(cx)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.tcp).poll_shutdown(cx)
    }
}
