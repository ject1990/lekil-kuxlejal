# Publicar Lekil Kuxlejal en Render

Esta configuración opcional sirve la interfaz React y la API Python en un único
Web Service, con SQLite en un disco persistente y acceso compartido mediante
usuario y contraseña. El inicio local continúa siendo `app.main:app`.

## Crear el servicio

1. En Render conserva el espacio de trabajo **Hobby**.
2. Elige **New → Blueprint** y conecta `ject1990/lekil-kuxlejal` desde tu GitHub.
3. Selecciona la rama **`deploy/render`** y el archivo **`render.yaml`**.
4. Introduce `LEKIL_WEB_USER` (tu usuario de acceso) y `LEKIL_WEB_PASSWORD`
   (una contraseña única y aleatoria de al menos 16 caracteres, sin acentos).
   Son credenciales de esta aplicación, no tu contraseña de GitHub o Render.
   Escríbelas exclusivamente en Render; no las incluyas en Git ni en capturas.
5. Revisa el resumen de cobro antes de crear: un servicio de 512 MB y 0.5 CPU
   (`0.5c-512mb`, anteriormente Starter) más un disco de 1 GB. La referencia
   consultada el 25 de octubre de 2026 es US$7 + US$0.25 por mes, antes de
   impuestos y consumos adicionales. Confirma el precio que muestre Render.
6. Crea el Blueprint. Cuando el servicio indique **Live**, abre su dirección
   HTTPS `onrender.com`. El navegador solicitará el usuario y contraseña del
   paso 4 antes de mostrar la aplicación.

Si ya abriste **New → Web Service**, también puedes utilizar esta tabla. La
carpeta raíz queda vacía para incluir `frontend`, `backend` y `referencias`.
La versión Python se obtiene de `.python-version` (3.12).

| Campo | Valor |
| --- | --- |
| Repository | `ject1990/lekil-kuxlejal` |
| Branch | `deploy/render` |
| Name | `lekil-kuxlejal` |
| Language | Python 3 |
| Region | Oregon |
| Root Directory | Vacío |
| Build Command | `bash scripts/render-build.sh` |
| Start Command | `python -m uvicorn app.hosted:create_hosted_app --factory --app-dir backend --host 0.0.0.0 --port $PORT --workers 1` |
| Instance Type | `0.5c-512mb` (512 MB; antes Starter) |
| Health Check Path | `/api/health` |
| Auto-Deploy | Off |
| Disk Mount Path | `/var/data` |
| Disk Size | 1 GB |
| `DATABASE_URL` | `sqlite:////var/data/lekil.db` (cuatro barras) |
| `LEKIL_DATA_DIR` | `/var/data` |
| `NODE_VERSION` | `22` |
| `LEKIL_WEB_USER` | Tu usuario, sin `:` ni acentos |
| `LEKIL_WEB_PASSWORD` | Tu contraseña privada, mínimo 16 caracteres, sin acentos |

El build compila React y conserva las migraciones de Alembic. El disco sólo
existe al ejecutar el servicio; las migraciones se realizan durante su inicio,
no durante el build. La aplicación rehúsa arrancar si faltan las credenciales,
la carpeta persistente o la interfaz compilada. Todos los registros nuevos se
guardan en `/var/data/lekil.db`. No se importan automáticamente datos de tu PC.

## Comprobar que funciona

- Sin contraseña, `/` y `/api/zones` deben solicitar autenticación (HTTP 401).
- `/api/health` es público y sólo informa del estado de la base de datos, modo
  observación, control físico deshabilitado y hora; no expone fichas.
- Tras iniciar sesión, abre Inicio, Domo, Recursos, Decisiones, Semillas,
  Alertas y Configuración. Recarga una ruta como `/semillas`.
- Sin registros propios, se deben mostrar listas vacías o «Sin datos».
- Cuando exista un registro auténtico, comprueba que se conserva después de
  **Manual Deploy → Restart service**. No generes datos ficticios de operación.
- Comprueba el consumo de memoria antes de decidir si necesitas ampliar el plan.

## Actualizaciones y respaldos

Los despliegues automáticos quedan desactivados. Primero revisa los cambios de
tu estudiante y su integración en esta rama; después crea un respaldo y usa
**Manual Deploy → Deploy latest commit**. Un disco adjunto implica una breve
interrupción durante cada actualización. No elimines el servicio o su disco
para solucionar un error sin descargar antes un respaldo.

Para crear un respaldo consistente con el servicio en marcha, abre **Shell**
en Render y ejecuta este bloque Python (la API de backup de SQLite coordina
las escrituras concurrentes):

```bash
python - <<'PY'
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

folder = Path('/var/data/backups')
folder.mkdir(exist_ok=True)
target = folder / (datetime.now(timezone.utc).strftime('lekil-%Y%m%dT%H%M%S%fZ') + '.db')
with target.open('xb'):
    pass
with closing(sqlite3.connect('file:/var/data/lekil.db?mode=ro', uri=True)) as source:
    with closing(sqlite3.connect(target)) as backup:
        source.backup(backup)
        assert backup.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
print(target)
PY
```

Descarga el archivo indicado mediante SSH/SCP o la herramienta `wormhole`
disponible en Render y conserva una copia fuera del servicio. Los snapshots
del proveedor no sustituyen este respaldo lógico. No se ha programado una
tarea de respaldo automático; revisa el espacio ocupado y la política de
conservación. La restauración requiere detener las escrituras y verificar la
copia antes de reemplazar la base; nunca sobrescribas una base activa.

## Alcance de esta primera publicación

- Acceso compartido para una demostración privada: no hay cuentas individuales,
  permisos por rol ni registro de quién inició sesión. Quien conoce la clave
  puede usar los formularios disponibles. Compártela sólo con personas autorizadas.
- HTTP Basic requiere HTTPS. Render termina TLS y redirige HTTP a HTTPS.
  El navegador conserva la sesión; en un equipo compartido utiliza una ventana
  privada y ciérrala al terminar. Para revocar el acceso, cambia la contraseña
  en Render y reinicia el servicio.
- No se publican archivos del repositorio, bases, documentos ni tokens mediante
  el servidor estático: únicamente `frontend/dist`.
- La entrada serial `/api/internal/*` está bloqueada en esta modalidad, incluso
  con contraseña. El ESP32 conectado por USB a tu PC no se conecta automáticamente
  a Render. No hay control físico ni nuevas lecturas simuladas.
- Se utiliza una única instancia y un trabajador para SQLite. No habilites
  varias réplicas con esta configuración. Los 512 MB deben validarse con la
  carga real, especialmente las comparaciones de escenarios.
- Conserva Tell It para el sitio actual. Después de verificar el servicio,
  puedes añadir un subdominio en **Settings → Custom Domains** y configurar
  el registro DNS que Render indique en NEUBOX.

Referencias oficiales:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/native-runtimes
- https://render.com/docs/python-version
- https://render.com/docs/disks
- https://render.com/pricing
