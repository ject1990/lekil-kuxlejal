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
  con contraseña. La conexión autorizada del navegador utiliza una ruta diferente,
  `/api/web-serial/*`, con autenticación, comprobación de origen y validación del
  protocolo. No hay control físico ni lecturas ambientales simuladas.
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


## Conexión USB desde la aplicación web · 25 de octubre de 2026

El usuario autorizó leer el ESP32 directamente desde la página alojada. Se
conserva el lector Python local; esta alternativa no necesita iniciar Python ni
Node.js en la computadora que tiene el USB. El navegador lee el puerto elegido
por la persona y envía los mensajes al mismo backend protegido en Render.

1. Publica los archivos de esta actualización en `deploy/render`.
2. En Render abre el servicio `lekil-kuxlejal` y selecciona **Manual Deploy →
   Deploy latest commit**. Espera **Live**. No cambian variables ni disco.
3. Abre la aplicación HTTPS en Chrome o Edge de escritorio, inicia sesión y
   entra en **Configuración → Conectar mi ESP32**.
4. Conecta la placa con un cable USB de datos. Cierra cualquier monitor serial,
   Arduino/PlatformIO o lector Python que esté usando ese mismo puerto.
5. Pulsa **Conectar ESP32 por USB**, selecciona el puerto y autoriza el acceso.
   El permiso se solicita sólo tras ese clic; no se conecta hardware en segundo
   plano ni se cargan programas en la placa.
6. Primero verás «USB abierto». La placa aparece al recibir un mensaje válido.
   Un heartbeat reciente hace que la tarjeta muestre **Conectado**; confirma que
   aumenta el tiempo activo y el contador de mensajes guardados. No basta con
   registrar una ficha manual o abrir el puerto.
7. Usa **Desconectar** antes de cerrar. La navegación dentro de la aplicación
   conserva el lector. Una recarga o el cierre de la pestaña lo detiene; al volver
   debes pulsar Conectar otra vez. Mantén la computadora despierta y con internet.

Si al retirar el cable el cierre puede enviarse, la tarjeta pasa a Desconectado.
Si se pierde internet o se cierra abruptamente la página, el heartbeat caduca a
los 10 segundos; al consultar la API no se informa una conexión vigente. Un
monitor suspendido en segundo plano no garantiza lectura continua. No hay
reconexión automática ni cola durable: se prioriza el mensaje pendiente más
reciente y se muestran descartes; los registros ya confirmados quedan en SQLite.

El firmware esperado es el protocolo existente de `firmware/src/main.cpp`:
ESP32 clásico, 115200 baudios, `hello`/`heartbeat`, versión de protocolo 1. El
firmware 0.2.0 no mide temperatura ni humedad. La función no conecta sensores,
no asigna pines, no graba firmware ni ejecuta control físico. La apertura del
USB puede reiniciar algunas placas según su adaptador; DTR/RTS se dejan inactivos.

Implementación: sesiones efímeras de tres minutos de inactividad (máximo 32),
mensajes de hasta 2048 bytes, cuerpo HTTP limitado, tasa por sesión acotada,
rechazo de formatos/identidades incorrectos, claves JSON duplicadas, secuencias
repetidas, futuras y mensajes atrasados. La hora del navegador se alinea con la
respuesta inicial del servidor; las confirmaciones rechazadas no aumentan el
contador de guardado. Las líneas se envían sin parsear/reconvertir sus enteros
64 bits en JavaScript. El backend reutiliza el servicio de persistencia local.
Las sesiones caducan al reiniciar Render: pulsa Desconectar y Conectar de nuevo.

Cada conexión tiene un identificador de origen propio, sin inventar un COM
que el navegador no revela. Una desconexión no marca otras conexiones como
retiradas. El origen es el navegador de una persona autorizada; no constituye
atestación criptográfica del hardware. La clave compartida conserva los mismos
límites de acceso del resto de la aplicación. No se añade una nueva migración.

La lectura directa depende de Web Serial. Cuando no existe soporte se muestra
un aviso, el botón queda deshabilitado y la consulta del resto de la aplicación
continúa disponible. Documentación primaria:
https://developer.chrome.com/docs/capabilities/serial

Pruebas: 193 pruebas de backend, 17 de frontend y build de producción correctos.
QA con Chromium, FastAPI real y SQLite temporal: permiso solicitado desde clic,
115200, navegación sin perder el lector, recepción, desconexión, reconexión sin
duplicar identidad, fallo de internet y caducidad, mensajes repetidos, UTF-8
inválido, puerto ocupado, cancelación y navegador no compatible. Vista de 390px
sin desbordamiento. El USB se sustituyó por un doble sólo en las pruebas: la
verificación con la placa física y el HTTPS de Render queda pendiente de subir
esta actualización. Ningún diagnóstico de prueba se envió al servicio operativo.
