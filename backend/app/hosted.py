"""Entrada opcional de alojamiento: interfaz y API con acceso compartido.

El inicio local app.main:app conserva su comportamiento. Esta fábrica requiere
credenciales y una ruta persistente explícitas antes de crear la aplicación.
"""

import base64
import binascii
import hashlib
import hmac
import os
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy.engine import make_url
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.types import ASGIApp, Message, Receive, Scope, Send


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
CLIENT_ROUTES = {
    "", "domo", "recursos", "decisiones", "semillas", "alertas", "configuracion",
    "domo/semillas", "domo/cultivos", "domo/biomasa", "domo/memoria",
    "recursos/inventarios", "recursos/recetas", "recursos/historial",
}


class HostedAccess:
    """HTTP Basic sobre HTTPS; la salud pública no contiene registros del usuario."""

    def __init__(self, app: ASGIApp, credential: bytes):
        self.app = app
        self.expected = hashlib.sha256(credential).digest()

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1008})
                return
            await self.app(scope, receive, send)
            return

        async def protected_send(message: Message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "same-origin"
                headers["X-Robots-Tag"] = "noindex, nofollow"
            await send(message)

        path = scope["path"]
        method = scope["method"]
        # Un proxy podría presentar una dirección local: bloquear la entrada
        # serial explícitamente en esta modalidad, incluso con credenciales.
        if path == "/api/internal" or path.startswith("/api/internal/"):
            await JSONResponse({"detail": "Interfaz serial no disponible en alojamiento."}, 404)(scope, receive, protected_send)
            return
        if path == "/api/health" and method in {"GET", "HEAD"}:
            await self.app(scope, receive, protected_send)
            return

        headers = Headers(scope=scope)
        scheme, _, encoded = headers.get("authorization", "").partition(" ")
        supplied = b""
        if scheme.lower() == "basic" and len(encoded) <= 8192:
            try:
                supplied = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                pass
        if not hmac.compare_digest(hashlib.sha256(supplied).digest(), self.expected):
            response = JSONResponse(
                {"detail": "Introduce el usuario y la contraseña de acceso."},
                status_code=401,
                headers={"WWW-Authenticate": 'Basic realm="Lekil Kuxlejal", charset="UTF-8"'},
            )
            await response(scope, receive, protected_send)
            return

        # Basic se conserva en el navegador. Rechazar escrituras procedentes
        # de otra página aunque el navegador adjunte la contraseña guardada.
        if method not in {"GET", "HEAD", "OPTIONS"}:
            origin = headers.get("origin")
            expected_origins = {f"https://{headers.get('host', '')}", f"http://{headers.get('host', '')}"}
            if headers.get("sec-fetch-site") == "cross-site" or (origin is not None and origin not in expected_origins):
                await JSONResponse({"detail": "Origen de escritura no autorizado."}, 403)(scope, receive, protected_send)
                return
            if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                await JSONResponse({"detail": "Las escrituras requieren application/json."}, 415)(scope, receive, protected_send)
                return
        await self.app(scope, receive, protected_send)


class FrontendFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope):
        # Sólo las rutas conocidas del cliente reciben index.html; /api y
        # archivos inexistentes conservan el 404 y nunca exponen el repositorio.
        if path.strip("/") in CLIENT_ROUTES or path == ".":
            path = "index.html"
        return await super().get_response(path, scope)


def create_hosted_app(*, frontend_dir: Path | None = None) -> FastAPI:
    username = os.environ.get("LEKIL_WEB_USER", "")
    password = os.environ.get("LEKIL_WEB_PASSWORD", "")
    if (not username.strip() or ":" in username or not username.isascii()
            or len(password) < 16 or not password.isascii()):
        raise RuntimeError("Configura LEKIL_WEB_USER y LEKIL_WEB_PASSWORD (mínimo 16 caracteres, sin acentos).")

    raw_dir = os.environ.get("LEKIL_DATA_DIR", "")
    data_dir = Path(raw_dir)
    if not raw_dir or not data_dir.is_absolute() or not data_dir.is_dir():
        raise RuntimeError("LEKIL_DATA_DIR debe señalar el directorio existente del disco persistente.")
    database_url = os.environ.get("DATABASE_URL", "")
    url = make_url(database_url) if database_url else None
    if url is None or url.drivername != "sqlite" or not url.database:
        raise RuntimeError("Configura DATABASE_URL con un archivo SQLite dentro del disco persistente.")
    database_path = Path(url.database)
    if not database_path.is_absolute() or not database_path.resolve().is_relative_to(data_dir.resolve()):
        raise RuntimeError("DATABASE_URL debe apuntar a un archivo absoluto dentro de LEKIL_DATA_DIR.")

    directory = frontend_dir or FRONTEND_DIST
    if not (directory / "index.html").is_file():
        raise RuntimeError("Falta compilar la interfaz: ejecuta bash scripts/render-build.sh.")

    from .main import create_app

    application = create_app(database_url)
    application.description = "DOMO VITAL: acceso compartido protegido. Modo observación; sin conexión serial remota."
    application.add_middleware(HostedAccess, credential=f"{username}:{password}".encode("utf-8"))
    application.mount("/", FrontendFiles(directory=str(directory)), name="frontend")
    return application
