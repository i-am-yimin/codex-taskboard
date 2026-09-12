use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    time::{Duration, Instant},
};

pub const COMPANION_ADDR: &str = "127.0.0.1:47831";

pub fn health_request(bridge_key: &str) -> String {
    format!(
        "GET /health HTTP/1.1\r\nHost: {COMPANION_ADDR}\r\nAccept: application/json\r\nConnection: close\r\nx-taskboard-companion-key: {bridge_key}\r\n\r\n"
    )
}

/// Requests a renderer-authorized graceful shutdown. The companion replies before
/// closing its listener, so callers can then wait a bounded interval for exit.
pub fn request_shutdown(bridge_key: &str, timeout: Duration) -> Result<bool, String> {
    let address: SocketAddr = COMPANION_ADDR
        .parse()
        .map_err(|error| format!("invalid companion address: {error}"))?;
    request_shutdown_at(address, bridge_key, timeout)
}

fn request_shutdown_at(address: SocketAddr, bridge_key: &str, timeout: Duration) -> Result<bool, String> {
    let deadline = Instant::now() + timeout;
    let mut stream = match TcpStream::connect_timeout(&address, remaining(deadline).unwrap_or_default()) {
        Ok(stream) => stream,
        Err(error) if retryable_io(&error) => return Ok(false),
        Err(error) => return Err(format!("cannot connect to companion: {error}")),
    };
    let budget = remaining(deadline).ok_or("companion shutdown request timed out")?;
    stream.set_read_timeout(Some(budget)).map_err(|error| error.to_string())?;
    stream.set_write_timeout(Some(budget)).map_err(|error| error.to_string())?;
    let request = format!(
        "POST /internal/shutdown HTTP/1.1\r\nHost: {address}\r\nContent-Length: 0\r\nConnection: close\r\nx-taskboard-companion-key: {bridge_key}\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).map_err(|error| error.to_string())?;
    let mut response = Vec::with_capacity(512);
    loop {
        let Some(left) = remaining(deadline) else { return Ok(false) };
        stream
            .set_read_timeout(Some(left.min(Duration::from_millis(100))))
            .map_err(|error| error.to_string())?;
        let mut chunk = [0_u8; 256];
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(count) => {
                response.extend_from_slice(&chunk[..count]);
                if response.len() > 4096 { return Ok(false) }
                if response.windows(4).any(|value| value == b"\r\n\r\n") { break }
            }
            Err(error) if retryable_io(&error) => return Ok(false),
            Err(error) => return Err(format!("cannot read companion shutdown response: {error}")),
        }
    }
    Ok(response.starts_with(b"HTTP/1.1 202 Accepted\r\n"))
}

pub fn healthy_response(response: &str) -> bool {
    let Some((head, body)) = response.split_once("\r\n\r\n") else {
        return false;
    };
    head.lines().next() == Some("HTTP/1.1 200 OK")
        && has_version_one(body)
        && body.contains("\"deviceId\":")
}

/// The companion serializes JSON compactly today, but accept whitespace around
/// the colon while requiring `version` to be exactly the JSON number 1.
fn has_version_one(body: &str) -> bool {
    let Some(after_key) = body.split_once("\"version\"").map(|(_, value)| value) else {
        return false;
    };
    let Some(after_colon) = after_key.trim_start().strip_prefix(':') else {
        return false;
    };
    let value = after_colon.trim_start();
    if !value.starts_with('1') {
        return false;
    }
    matches!(
        value.as_bytes().get(1),
        None | Some(b',' | b'}' | b']' | b' ' | b'\t' | b'\r' | b'\n')
    )
}

fn retryable_io(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::ConnectionRefused
            | std::io::ErrorKind::ConnectionReset
            | std::io::ErrorKind::NotConnected
            | std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::WouldBlock
    )
}

fn remaining(deadline: Instant) -> Option<Duration> {
    deadline.checked_duration_since(Instant::now())
}

/// Probes only the fixed loopback companion port. A 200 response is accepted only
/// when the random per-launch bridge key authenticated the request.
fn probe_health_at(
    address: SocketAddr,
    bridge_key: &str,
    timeout: Duration,
) -> Result<bool, String> {
    let deadline = Instant::now() + timeout;
    let mut stream = match TcpStream::connect_timeout(&address, timeout) {
        Ok(stream) => stream,
        Err(error) if retryable_io(&error) => return Ok(false),
        Err(error) => return Err(format!("cannot connect to companion: {error}")),
    };
    let Some(budget) = remaining(deadline) else {
        return Ok(false);
    };
    stream
        .set_read_timeout(Some(budget))
        .map_err(|error| format!("cannot set companion read timeout: {error}"))?;
    stream
        .set_write_timeout(Some(budget))
        .map_err(|error| format!("cannot set companion write timeout: {error}"))?;
    if let Err(error) = stream.write_all(health_request(bridge_key).as_bytes()) {
        return if retryable_io(&error) {
            Ok(false)
        } else {
            Err(format!("cannot send companion health request: {error}"))
        };
    }
    let mut response = Vec::new();
    let mut buffer = [0_u8; 1024];
    loop {
        let Some(budget) = remaining(deadline) else {
            return Ok(false);
        };
        stream
            .set_read_timeout(Some(budget))
            .map_err(|error| format!("cannot set companion read timeout: {error}"))?;
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(read) => {
                response.extend_from_slice(&buffer[..read]);
                if response.len() > 16 * 1024 {
                    return Err("companion health response exceeds 16 KiB".into());
                }
                if let Ok(text) = std::str::from_utf8(&response) {
                    if healthy_response(text) {
                        return Ok(true);
                    }
                }
            }
            Err(error) if retryable_io(&error) => return Ok(false),
            Err(error) => return Err(format!("cannot read companion health response: {error}")),
        }
    }
    let response = String::from_utf8_lossy(&response);
    if healthy_response(&response) {
        return Ok(true);
    }
    if response.starts_with("HTTP/") {
        return Err("伴随服务健康检查未通过认证；端口 47831 可能由其他程序占用。".into());
    }
    Ok(false)
}

pub fn probe_health(bridge_key: &str, timeout: Duration) -> Result<bool, String> {
    let address: SocketAddr = COMPANION_ADDR
        .parse()
        .map_err(|error| format!("invalid companion address: {error}"))?;
    probe_health_at(address, bridge_key, timeout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, sync::mpsc, thread, time::Instant};

    #[test]
    fn health_request_carries_only_the_supplied_bridge_key() {
        let request = health_request("random-launch-key");
        assert!(request.starts_with("GET /health HTTP/1.1\r\n"));
        assert!(request.contains("x-taskboard-companion-key: random-launch-key\r\n"));
        assert!(!request.contains("Authorization"));
    }

    #[test]
    fn accepts_only_the_expected_authenticated_health_shape() {
        assert!(healthy_response("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{\"data\":{\"version\":1,\"deviceId\":\"device\"}}"));
        assert!(!healthy_response("HTTP/1.1 200 OK\r\n\r\n{}"));
        assert!(!healthy_response(
            "HTTP/1.1 200 OK\r\n\r\n{\"data\":{\"version\":10,\"deviceId\":\"device\"}}"
        ));
        assert!(!healthy_response(
            "HTTP/1.1 401 Unauthorized\r\n\r\n{\"error\":{}}"
        ));
        assert!(!healthy_response("not http"));
    }

    #[test]
    fn probes_a_real_loopback_listener_with_the_random_bridge_key() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (sender, receiver) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 1024];
            let read = socket.read(&mut buffer).unwrap();
            sender
                .send(String::from_utf8_lossy(&buffer[..read]).into_owned())
                .unwrap();
            socket.write_all(b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n{\"data\":{\"version\":1,\"deviceId\":\"device\"}}").unwrap();
        });
        assert_eq!(
            probe_health_at(address, "socket-key", Duration::from_millis(200)),
            Ok(true)
        );
        assert!(receiver
            .recv()
            .unwrap()
            .contains("x-taskboard-companion-key: socket-key\r\n"));
        server.join().unwrap();
    }

    #[test]
    fn rejects_another_process_listening_on_the_companion_port() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 1024];
            let _ = socket.read(&mut buffer).unwrap();
            socket
                .write_all(b"HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n{}")
                .unwrap();
            socket.flush().unwrap();
        });
        let result = probe_health_at(address, "socket-key", Duration::from_millis(200));
        assert!(result.unwrap_err().contains("端口 47831"));
        server.join().unwrap();
    }

    #[test]
    fn nonresponsive_listener_is_pending_and_bounded_by_the_probe_timeout() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (_socket, _) = listener.accept().unwrap();
            thread::sleep(Duration::from_secs(1));
        });
        let started = Instant::now();
        assert_eq!(
            probe_health_at(address, "socket-key", Duration::from_millis(30)),
            Ok(false)
        );
        // Windows socket timeouts are rounded by the OS; this proves the probe
        // remains bounded instead of waiting for the listener's one-second sleep.
        assert!(started.elapsed() < Duration::from_millis(500));
        server.join().unwrap();
    }

    #[test]
    fn slow_drip_cannot_extend_the_single_probe_deadline() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 1024];
            let _ = socket.read(&mut buffer);
            for byte in b"HTTP/1.1 200 OK\r\n\r\n{\"data\":{\"version\":1,\"deviceId\":\"device\"}}"
            {
                if socket.write_all(&[*byte]).is_err() {
                    break;
                }
                let _ = socket.flush();
                thread::sleep(Duration::from_millis(20));
            }
        });
        let started = Instant::now();
        assert_eq!(
            probe_health_at(address, "socket-key", Duration::from_millis(60)),
            Ok(false)
        );
        assert!(started.elapsed() < Duration::from_millis(500));
        server.join().unwrap();
    }

    #[test]
    fn shutdown_posts_the_bridge_key_and_accepts_202_before_socket_close() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (sender, receiver) = mpsc::channel();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 1024];
            let read = socket.read(&mut buffer).unwrap();
            sender.send(String::from_utf8_lossy(&buffer[..read]).into_owned()).unwrap();
            socket.write_all(b"HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\n\r\n").unwrap();
            thread::sleep(Duration::from_millis(100));
        });
        assert_eq!(request_shutdown_at(address, "shutdown-key", Duration::from_millis(300)), Ok(true));
        let request = receiver.recv().unwrap();
        assert!(request.starts_with("POST /internal/shutdown HTTP/1.1\r\n"));
        assert!(request.contains("x-taskboard-companion-key: shutdown-key\r\n"));
        server.join().unwrap();
    }

    #[test]
    fn slow_drip_cannot_extend_shutdown_deadline() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 512]; let _ = socket.read(&mut buffer);
            for byte in b"HTTP/1.1 202 Accepted\r\n" { if socket.write_all(&[*byte]).is_err() { break; } thread::sleep(Duration::from_millis(20)); }
        });
        let started = Instant::now();
        assert_eq!(request_shutdown_at(address, "key", Duration::from_millis(60)), Ok(false));
        assert!(started.elapsed() < Duration::from_millis(500));
        server.join().unwrap();
    }
}
