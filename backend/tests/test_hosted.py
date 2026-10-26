"""Verificación de publicación con datos y credenciales exclusivamente temporales."""

import pytest
from fastapi.testclient import TestClient

from app.hosted import create_hosted_app


AUTH = ("qa", "only-for-temporary-test-1234")


@pytest.fixture
def hosted_settings(tmp_path, monkeypatch):
    data = tmp_path / "persistent"
    data.mkdir()
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>Interfaz de prueba</title>", encoding="utf-8")
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("// archivo de prueba", encoding="utf-8")
    monkeypatch.setenv("LEKIL_WEB_USER", AUTH[0])
    monkeypatch.setenv("LEKIL_WEB_PASSWORD", AUTH[1])
    monkeypatch.setenv("LEKIL_DATA_DIR", str(data))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{data / 'hosted.db'}")
    return dist


@pytest.fixture
def hosted_client(hosted_settings):
    with TestClient(create_hosted_app(frontend_dir=hosted_settings)) as client:
        yield client


@pytest.mark.parametrize("path", ["/", "/semillas", "/assets/app.js", "/api/zones", "/docs", "/openapi.json"])
def test_requires_password_for_interface_and_api(hosted_client, path):
    response = hosted_client.get(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Basic ")
    assert response.headers["cache-control"] == "no-store"
    assert hosted_client.post("/api/zones", json={"name": "No autorizado", "purpose": "QA"}).status_code == 401
    assert hosted_client.get("/api/zones", auth=AUTH).json() == []


@pytest.mark.parametrize("authorization", ["Basic ???", "Basic YQ==", "Bearer test", "Basic \u00f1", "Basic", "Basic " + "a" * 9000],
                         ids=["invalid-base64", "incomplete", "wrong-scheme", "non-ascii", "empty", "oversized"])
def test_malformed_or_wrong_credentials_are_rejected(hosted_client, authorization):
    response = hosted_client.get("/api/zones", headers={b"authorization": authorization.encode("utf-8")})
    assert response.status_code == 401
    assert hosted_client.get("/", auth=("qa", "incorrect-password")).status_code == 401


def test_public_health_has_no_operational_records(hosted_client):
    response = hosted_client.get("/api/health")
    assert response.status_code == 200
    assert set(response.json()) == {"status", "database", "mode", "control_enabled", "timestamp"}
    assert response.json()["database"] == "connected"
    assert response.json()["control_enabled"] is False


@pytest.mark.parametrize("path", ["/", "/domo", "/recursos", "/decisiones", "/semillas", "/alertas", "/configuracion", "/semillas/", "/domo/cultivos", "/recursos/inventarios"])
def test_direct_navigation_and_reload_return_frontend(hosted_client, path):
    response = hosted_client.get(path, auth=AUTH)
    assert response.status_code == 200
    assert "Interfaz de prueba" in response.text


@pytest.mark.parametrize("path", ["/api/not-found", "/assets/missing.js", "/backend/data/hosted.db", "/.env", "/%2e%2e/secret.txt"])
def test_missing_api_and_private_paths_are_not_spa(hosted_client, path):
    response = hosted_client.get(path, auth=AUTH)
    assert response.status_code == 404
    assert "Interfaz de prueba" not in response.text


def test_serial_is_disabled_even_with_password(hosted_client):
    for auth in (None, AUTH):
        response = hosted_client.post("/api/internal/serial-events", json={}, auth=auth)
        assert response.status_code == 404


@pytest.mark.parametrize("origin", ["https://other.example", "null", "http://localhost:5173"])
def test_rejects_cross_origin_writes(hosted_client, origin):
    response = hosted_client.post("/api/zones", json={"name": "Prueba", "purpose": "QA"},
                                  auth=AUTH, headers={"Origin": origin})
    assert response.status_code == 403
    assert hosted_client.get("/api/zones", auth=AUTH).json() == []


def test_rejects_cross_site_and_form_requests(hosted_client):
    assert hosted_client.post("/api/zones", json={}, auth=AUTH,
                              headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert hosted_client.post("/api/zones", content="{}", auth=AUTH,
                              headers={"Content-Type": "text/plain"}).status_code == 415


def test_authenticated_data_persists_across_restarts(hosted_settings):
    with TestClient(create_hosted_app(frontend_dir=hosted_settings)) as first:
        response = first.post("/api/zones", auth=AUTH, headers={"Origin": "https://testserver"},
                              json={"name": "Zona de prueba temporal", "purpose": "QA"})
        assert response.status_code == 201
        zone = response.json()
    with TestClient(create_hosted_app(frontend_dir=hosted_settings)) as second:
        assert second.get("/api/zones", auth=AUTH).json() == [zone]
        assert second.get("/api/telemetry", auth=AUTH).json()["items"] == []
        assert second.get("/api/devices", auth=AUTH).json() == []


@pytest.mark.parametrize("name,value", [
    ("LEKIL_WEB_USER", ""), ("LEKIL_WEB_USER", "bad:name"),
    ("LEKIL_WEB_PASSWORD", "short"), ("LEKIL_WEB_PASSWORD", ""),
    ("LEKIL_DATA_DIR", "relative"), ("LEKIL_DATA_DIR", "/directory-that-does-not-exist"),
    ("DATABASE_URL", ""), ("DATABASE_URL", "sqlite:///relative.db"),
    ("DATABASE_URL", "sqlite:///:memory:"), ("DATABASE_URL", "sqlite:////tmp/outside.db"),
])
def test_refuses_incomplete_hosting_configuration(hosted_settings, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError):
        create_hosted_app(frontend_dir=hosted_settings)


def test_refuses_missing_frontend(hosted_settings):
    (hosted_settings / "index.html").unlink()
    with pytest.raises(RuntimeError, match="Falta compilar"):
        create_hosted_app(frontend_dir=hosted_settings)


# All USB data below is synthetic and lives exclusively in pytest tmp_path.
import json
import secrets
from datetime import datetime, timedelta, timezone

USB_HEADERS = {"Origin": "https://testserver", "X-Lekil-Serial": "1"}


def usb_session(client):
    response = client.post('/api/web-serial/session', json={}, auth=AUTH, headers=USB_HEADERS)
    assert response.status_code == 200
    return response.json()['connection_id']


def usb_event(connection, *, sequence=1, age=0, kind='message', hardware='esp32-0123456789ab', **changes):
    value = {'connection_id': connection, 'event_id': secrets.token_hex(16),
             'received_at': (datetime.now(timezone.utc) - timedelta(seconds=age)).isoformat(), 'kind': kind}
    if kind == 'message':
        message = {'protocol_version': 1, 'type': 'heartbeat', 'device_id': hardware,
                   'chip_model': 'ESP32-D0WD-V3', 'firmware_version': '0.2.0',
                   'boot_id': '0123456789abcdef', 'uptime_ms': sequence * 3000, 'sequence': sequence}
        value['line'] = json.dumps(message) + '\n'
    return {**value, **changes}


def usb_post(client, event):
    return client.post('/api/web-serial/events', json=event, auth=AUTH, headers=USB_HEADERS)


def test_usb_requires_auth_origin_header_and_json(hosted_client):
    url = '/api/web-serial/session'
    assert hosted_client.post(url, json={}, headers=USB_HEADERS).status_code == 401
    for headers in ({}, {'Origin': 'https://testserver'}, {'X-Lekil-Serial': '1'},
                    {**USB_HEADERS, 'Origin': 'https://evil.test'}, {**USB_HEADERS, 'Sec-Fetch-Site': 'cross-site'}):
        assert hosted_client.post(url, json={}, auth=AUTH, headers=headers).status_code == 403
    assert hosted_client.post(url, content='{}', auth=AUTH, headers={**USB_HEADERS, 'Content-Type': 'text/plain'}).status_code == 415
    assert hosted_client.post(url, content='x' * 300, auth=AUTH, headers={**USB_HEADERS, 'Content-Type': 'application/json'}).status_code == 413
    assert usb_post(hosted_client, usb_event('0' * 32)).status_code == 409


def test_usb_diagnostics_persist_without_sensor_measurements(hosted_settings):
    with TestClient(create_hosted_app(frontend_dir=hosted_settings)) as first:
        connection = usb_session(first)
        event = usb_event(connection)
        response = usb_post(first, event)
        assert response.json()['accepted'] is True
        device = first.get('/api/devices', auth=AUTH).json()[0]
        assert device['status'] == 'connected'
        assert device['serial_port'] == f'USB navegador {connection}'
        assert device['uptime_ms'] == 3000
        assert usb_post(first, event).json()['reason'] == 'duplicate'
        assert usb_post(first, usb_event(connection, sequence=2)).json()['accepted'] is True
        assert usb_post(first, usb_event(connection, sequence=1)).json()['accepted'] is False
        assert first.get('/api/telemetry', auth=AUTH).json()['total'] == 0
    with TestClient(create_hosted_app(frontend_dir=hosted_settings)) as second:
        assert second.get('/api/devices', auth=AUTH).json()[0]['last_sequence'] == 2
        assert usb_post(second, usb_event(connection, sequence=3)).status_code == 409
        assert second.get('/api/telemetry', auth=AUTH).json()['total'] == 0


@pytest.mark.parametrize('line', [
    'hello\n', '{"protocol_version":1,"protocol_version":1}\n', '{"temperature":22}\n',
    'x' * 2048 + '\n', '{}', '{}\n',
])
def test_usb_rejects_invalid_firmware_and_does_not_make_records(hosted_client, line):
    connection = usb_session(hosted_client)
    assert usb_post(hosted_client, usb_event(connection, line=line)).status_code == 422
    assert hosted_client.get('/api/devices', auth=AUTH).json() == []
    assert hosted_client.get('/api/telemetry', auth=AUTH).json()['total'] == 0


def test_usb_limits_body_and_validates_real_protocol(hosted_client):
    connection = usb_session(hosted_client)
    assert usb_post(hosted_client, usb_event(connection, line='x' * 9000)).status_code == 413
    event = usb_event(connection)
    message = json.loads(event['line'])
    for key, bad in [('sequence', True), ('chip_model', 'ESP32-S3'), ('protocol_version', 2), ('temperature', 25)]:
        assert usb_post(hosted_client, {**event, 'line': json.dumps({**message, key: bad}) + '\n'}).status_code == 422
    duplicate = event['line'].replace('"sequence": 1', '"sequence": 1, "sequence": 2')
    assert usb_post(hosted_client, {**event, 'line': duplicate}).status_code == 422
    huge_counter = 9007199254740993
    large = {**message, 'sequence': huge_counter, 'uptime_ms': huge_counter}
    assert usb_post(hosted_client, {**event, 'line': json.dumps(large) + '\n'}).json()['accepted'] is True
    assert hosted_client.get('/api/devices', auth=AUTH).json()[0]['last_sequence'] == huge_counter


def test_usb_disconnect_is_scoped_and_reconnect_keeps_identity(hosted_client):
    a, b = usb_session(hosted_client), usb_session(hosted_client)
    usb_post(hosted_client, usb_event(a))
    usb_post(hosted_client, usb_event(b, hardware='esp32-aaaaaaaaaaaa'))
    assert usb_post(hosted_client, usb_event(a, kind='disconnected')).json()['accepted'] is True
    devices = hosted_client.get('/api/devices', auth=AUTH).json()
    assert {d['hardware_id']: d['status'] for d in devices} == {'esp32-0123456789ab': 'disconnected', 'esp32-aaaaaaaaaaaa': 'connected'}
    c = usb_session(hosted_client)
    assert usb_post(hosted_client, usb_event(c, sequence=2)).json()['accepted'] is True
    assert len(hosted_client.get('/api/devices', auth=AUTH).json()) == 2
    assert usb_post(hosted_client, usb_event(c, sequence=3, hardware='esp32-bbbbbbbbbbbb')).status_code == 409


def test_usb_never_rejuvenates_old_messages(hosted_client):
    connection = usb_session(hosted_client)
    assert usb_post(hosted_client, usb_event(connection, age=30)).json()['reason'] == 'expired'
    assert usb_post(hosted_client, usb_event(connection, age=-60)).status_code == 422
    assert hosted_client.get('/api/devices', auth=AUTH).json() == []
    assert usb_post(hosted_client, usb_event(connection, age=11)).json()['accepted'] is True
    assert hosted_client.get('/api/devices', auth=AUTH).json()[0]['status'] == 'stale'


def test_usb_sessions_expire_and_rate_is_bounded(hosted_client, monkeypatch):
    from app import web_serial
    from types import SimpleNamespace
    now = web_serial.time.monotonic()
    monkeypatch.setattr(web_serial, 'time', SimpleNamespace(monotonic=lambda: now))
    connection = usb_session(hosted_client)
    for number in range(1, 9):
        assert usb_post(hosted_client, usb_event(connection, sequence=number)).status_code == 200
    assert usb_post(hosted_client, usb_event(connection, sequence=9)).status_code == 429
    now += 181
    assert usb_post(hosted_client, usb_event(connection, sequence=10)).status_code == 409


def test_usb_is_not_exposed_on_local_app(client):
    assert client.post('/api/web-serial/session', json={}, headers=USB_HEADERS).status_code == 404
