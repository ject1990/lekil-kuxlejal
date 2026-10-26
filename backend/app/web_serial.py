"""USB leído por el navegador autenticado -> diagnósticos validados en SQLite.

Sólo se monta en la aplicación alojada, detrás de HostedAccess. No expone el
token ni el endpoint del lector Python local, ni acepta órdenes de actuación.
"""

from datetime import datetime, timezone
import secrets
import threading
import time
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import AwareDatetime, BaseModel, ConfigDict, StringConstraints, ValidationError
from sqlmodel import Session

from .device_service import ingest_event
from .serial_protocol import SerialEventInput, parse_line


HexId = Annotated[str, StringConstraints(strict=True, pattern=r"^[0-9a-f]{32}$")]


class BrowserEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    connection_id: HexId
    event_id: HexId
    received_at: AwareDatetime
    kind: Literal["message", "reader_stopped", "disconnected"]
    line: Annotated[str, StringConstraints(strict=True, max_length=2048)] | None = None


async def read_payload(request: Request, limit: int = 8192) -> bytes:
    # Un encabezado propio + origen explícito impiden formularios y llamadas
    # desde otras páginas aunque el navegador recuerde la contraseña Basic.
    origin = request.headers.get("origin")
    host = request.headers.get("host", "")
    if (request.headers.get("x-lekil-serial") != "1"
            or origin not in (f"https://{host}", f"http://{host}")):
        raise HTTPException(403, "Conecta el ESP32 desde esta misma aplicación.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > limit:
            raise HTTPException(413, "Mensaje USB demasiado grande.")
        data.extend(chunk)
    return bytes(data)


def create_web_serial_router() -> APIRouter:
    router = APIRouter(prefix="/api/web-serial", tags=["USB del navegador"])
    # Sólo conexiones efímeras; los diagnósticos persisten mediante ingest_event.
    connections: dict[str, dict] = {}
    lock = threading.RLock()

    def expire(now: float):
        for key in list(connections):
            if now - connections[key]["seen"] > 180:
                del connections[key]

    @router.post("/session")
    async def start(request: Request):
        await read_payload(request, 256)
        with lock:
            now = time.monotonic()
            expire(now)
            if len(connections) >= 32:
                raise HTTPException(429, "Hay demasiadas conexiones USB. Espera unos minutos.")
            key = secrets.token_hex(16)
            connections[key] = {"seen": now, "tokens": 8.0, "rate_at": now, "hardware_id": None}
        return {"connection_id": key, "server_time": datetime.now(timezone.utc).isoformat()}

    @router.post("/events")
    async def receive(request: Request):
        raw = await read_payload(request)
        try:
            payload = BrowserEvent.model_validate_json(raw)
            if payload.kind == "message":
                if payload.line is None:
                    raise ValueError("Falta la línea USB.")
                message = parse_line(payload.line.encode("utf-8"))
            else:
                if payload.line is not None:
                    raise ValueError("La desconexión no debe contener un mensaje.")
                message = None
            event = SerialEventInput(
                event_id=payload.event_id, port=f"USB navegador {payload.connection_id}",
                received_at=payload.received_at, kind=payload.kind, message=message,
                detail=None if message else "Lectura USB del navegador finalizada.",
            )
        except (ValueError, ValidationError, UnicodeError):
            raise HTTPException(422, "El mensaje no corresponde al firmware de diagnóstico de Lekil Kuxlejal.") from None
        age = (datetime.now(timezone.utc) - payload.received_at).total_seconds()
        if age > 15:
            return {"accepted": False, "reason": "expired", "device_id": None}
        with lock:
            now = time.monotonic()
            expire(now)
            connection = connections.get(payload.connection_id)
            if connection is None:
                raise HTTPException(409, "La sesión USB caducó. Desconecta y vuelve a conectar desde la página.")
            available = min(8.0, connection["tokens"] + (now - connection["rate_at"]) * 2)
            connection["rate_at"] = now
            if available < 1:
                raise HTTPException(429, "La placa envía mensajes demasiado rápido.")
            connection["tokens"] = available - 1
            if message and connection["hardware_id"] not in (None, message.device_id):
                raise HTTPException(409, "La identidad de la placa cambió. Vuelve a conectarla.")
            # Un solo worker con disco, como render.yaml. Serializa escrituras
            # concurrentes para conservar la deduplicación del protocolo local.
            with Session(request.app.state.engine) as session:
                result = ingest_event(session, event)
            connection["seen"] = now
            if message and result["accepted"]:
                connection["hardware_id"] = message.device_id
            if message is None:
                del connections[payload.connection_id]
            return {**result, "message_type": message.type if message else None,
                    "hardware_id": message.device_id if message else None}

    return router
