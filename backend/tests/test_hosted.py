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
