# Fase 2C-A · Lenguaje claro y banco biocultural de semillas

Entrega local del 19 de octubre de 2026. Alcance autorizado: pasaportes de semillas, evaluación provisional y decisión humana. Se conservan las fases anteriores y el mapa de Decisiones.

## Referencia y decisiones de implementación

Se consultaron únicamente el índice y el capítulo 6 del expediente técnico LEKIL KUXLEJAL MARTE, versión 1.1 recibida del usuario. El capítulo identifica pasaporte biocultural, pruebas documentadas, decisiones humanas y seis criterios. No se incorporó el portafolio propuesto como datos reales ni se reprodujeron conocimientos privados.

Pesos iniciales: nutrición 25 %, agua/energía/volumen 20 %, duración/continuidad 15 %, fracción comestible/residuos 15 %, valor culinario/emocional 15 %, resiliencia/mantenimiento 10 %. Son una propuesta revisable, no resultados de validación.

El capítulo no fija escala numérica. La aplicación adopta explícitamente una **escala provisional de preferencia de 0 a 5**, mayor = preferencia más alta justificada. Cada evaluación requiere fuente y justificación por puntuación. En recursos, una nota mayor expresa preferencia por menor demanda documentada; no convierte esa valoración en un consumo físico medido.

Resultado global = suma de `puntuación × peso / 100`, entre 0 y 5. Sólo se calcula si están las seis puntuaciones. Cero es una puntuación válida; un dato desconocido es nulo. No hay clasificación automática ni selección por mayor puntuación. La comparación mantiene el orden de consulta y exige revisión humana. La sensibilidad a los pesos se revisa manualmente, conservando versiones; no se ha desarrollado un análisis automático de sensibilidad.

## Funcionalidad entregada

- Ruta `/semillas`, accesible desde la navegación principal y móvil. Conserva la identidad visual de DOMO VITAL.
- Registro, consulta y edición del pasaporte: nombres, variedad, código único, cantidad/unidad, procedencia, entidad/comunidad custodiante, autorización y condiciones, ingreso, conservación, envase, ubicación, pruebas, observaciones y fuente.
- Germinación y viabilidad admiten varios registros de prueba. Resultado y fuente son obligatorios para una prueba registrada; fecha y método pueden desconocerse y se muestran como «Sin datos».
- Autorización inicialmente «Pendiente de comprobar». Declarar autorización o denegación exige referencia documental; la autorización también exige condiciones de uso. Registrar no concede un permiso.
- Tipos `real` e `hypothetical` explícitos e inmutables. Los ejemplos no se convierten en lotes reales. Las comparaciones no mezclan ambos tipos.
- Evaluaciones incompletas guardadas sin total. Hasta 20 lotes por comparación; si falta una evaluación completa y vigente, no se presenta una clasificación completa ni se habilita selección final.
- Pesos editables: seis valores no negativos que sumen 100 %. Guardar crea una versión y conserva las evaluaciones anteriores. Los cambios de pasaporte o pesos obligan a revisar evaluaciones antes de otra selección.
- Decisiones humanas: conservar, sembrar, retirar, repetir prueba o seleccionar para el plan. Se conservan responsable declarado, fecha UTC, motivo y copia de los datos revisados. La selección guarda además la comparación y sus pesos. Si cambian datos o evaluaciones, una comparación antigua no puede aprobarse.
- Sembrar o seleccionar exige autorización de uso documentada. Conservar, retirar y repetir prueba siguen disponibles cuando la autorización está pendiente o denegada.
- Una decisión registra intención; no ejecuta una siembra, no altera existencias y no acciona hardware.
- Historial consultable de versiones de pasaporte, evaluaciones y decisiones. Persistencia SQLite tras reinicio.
- Decisiones muestra «Escenario de prueba — valores hipotéticos», aclara cálculos frente a mediciones y usa los textos claros pedidos. La traducción se realiza en presentación; los resultados matemáticos, unidades y balances de Itzamná permanecen intactos. Su atribución se conserva.

## Persistencia y contratos

Migración aditiva `0004_seeds`, posterior a `0003_decisions`. No usa `create_all` ni precarga lotes o evaluaciones. Al iniciar, Alembic crea únicamente las tablas nuevas. No se modificaron las migraciones anteriores.

| Tabla | Contenido |
| --- | --- |
| `seed_lots` | Identidad UUID estable, código único, tipo real/hipotético, pasaporte vigente y revisión |
| `seed_lot_revisions` | Copias históricas del pasaporte por lote/revisión |
| `seed_weight_profiles` | Versiones humanas de pesos, responsable, motivo y fecha |
| `seed_assessments` | Puntuaciones justificadas, fuentes, pesos y revisión del pasaporte utilizada |
| `seed_decisions` | Decisión humana y copia íntegra de sus datos y comparación |

Claves foráneas activas; una evaluación debe enlazar una revisión existente del pasaporte. Los UUID permiten incorporar posteriormente relaciones desde zonas/ciclos de cultivo mediante otra migración; no se crean ciclos, asociaciones ni entidades hidropónicas en esta fase.

La edición usa `expected_revision`. Las escrituras serializan comprobación y persistencia en una transacción SQLite. Una revisión o comparación obsoleta se rechaza, sin reemplazar silenciosamente la evidencia.

| Método y ruta bajo `/api/seeds` | Función |
| --- | --- |
| `GET /lots` | Lista; filtros `source_kind`, `offset` y `limit` |
| `POST /lots` | Registrar pasaporte |
| `GET /lots/{lot_id}` | Consultar lote |
| `PUT /lots/{lot_id}` | Editar con revisión esperada y conservar versión anterior |
| `GET /weights` | Pesos vigentes, criterios y escala |
| `POST /weights` | Guardar una nueva versión humana de pesos |
| `POST /lots/{lot_id}/assessments` | Guardar evaluación completa o incompleta |
| `POST /compare` | Consultar comparación; no guarda ni elige automáticamente |
| `POST /lots/{lot_id}/decisions` | Registrar decisión humana; selección exige comparación vigente |
| `GET /lots/{lot_id}/history` | Versiones, evaluaciones y decisiones |

Errores: 404 para lote inexistente; 409 para código duplicado o revisión/comparación obsoleta; 422 para datos inválidos, permisos pendientes en siembra/selección o comparación incompleta/mezclada; 503 si SQLite no está disponible. Contratos completos en OpenAPI local.

## Pruebas y resultados

Verificación final: `scripts/check.ps1`, **115 pruebas de backend aprobadas** y build React/TypeScript/Vite correcto. Incluye las regresiones de fases 1, 2A y 2B. Persiste una advertencia de deprecación de Starlette/AnyIO en TestClient, sin fallos.

Pruebas específicas: base vacía, creación y edición, historial y reinicio SQLite, fechas UTC, cantidad sin unidad, código duplicado, información no sustentada, autorización pendiente/denegada, tipo real/hipotético, seis puntuaciones y fuentes, ceros, evaluaciones incompletas, cálculo ponderado, pesos revisados, selección humana del lote con menor puntuación, datos obsoletos, integridad de revisión y migración sin alterar decisiones anteriores.

`npm.cmd run test:map`: **8 pruebas aprobadas**; selección, proyección sin mutaciones, ausencia de datos y navegación/diseño del mapa siguen funcionando.

Comprobación en navegador con API `8001`, frontend `4173` y SQLite temporal bajo `.run/`: registro y edición, autorización pendiente, evaluaciones incompleta/completa, comparación de dos ejemplos hipotéticos, bloqueo de selección sin permiso y decisión humana trazable. Se comprobó la navegación móvil a 390 × 844 sin desbordamiento horizontal y se restauró la vista de escritorio. Se verificaron también los textos del mapa con un resultado real de la API temporal. No se introdujeron ejemplos en `backend/data/`.

Captura local de la interfaz: `output/qa/fase2ca-semillas.jpg`. Es evidencia de la base temporal de pruebas y está excluida de Git.

## Abrir y probar en Windows

Desde `C:\Users\mende\Documents\lekil-kuxlejal`, con las dependencias ya instaladas:

1. Si hay un backend anterior abierto, detenerlo con Ctrl+C en su terminal. Conservar la base. Iniciar de nuevo para cargar las rutas y aplicar la migración:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
   ```

2. En otra terminal en la misma carpeta:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
   ```

3. Abrir `http://127.0.0.1:5173/semillas`. El banco se muestra vacío hasta que una persona registre lotes. El lector serial no es necesario para Semillas.
4. Registrar un lote real únicamente con evidencia disponible. Para ensayar, marcar expresamente «Ejemplo hipotético»; no confundirlo con existencias reales. Comprobar los campos desconocidos y la autorización pendiente.
5. Abrir el lote, editarlo, añadir pruebas documentadas y consultar las versiones en Historial. Para una siembra o selección real se requiere autorización documentada y sus condiciones.
6. En Evaluar, dejar un criterio vacío y guardar: la evaluación queda incompleta. Completar después los seis valores con justificación y fuente, y guardar otra evaluación. Registrar otro lote del mismo tipo y evaluarlo.
7. Marcar los dos lotes y comparar. Examinar fuentes, pesos y estado de autorización. Elegir deliberadamente un lote autorizado, indicar responsable y motivo, y registrar la decisión humana. Consultar el historial.
8. Cerrar y reiniciar backend/frontend; reabrir la ficha y comprobar que se conservan pasaporte, evaluaciones y decisiones. La base habitual sigue siendo `backend/data/lekil.db`.

Para repetir la verificación automatizada desde la raíz:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
npm.cmd --prefix frontend run test:map
```

## Límites pendientes

La evaluación es provisional y depende de evidencia introducida por personas. No valida germinación, viabilidad científica, rendimientos, suficiencia alimentaria ni derechos de uso. La sensibilidad a pesos se revisa manualmente. No se verifican documentos externos ni identidades: responsable es un rol/identificador declarado, sin autenticación. Se mantiene uso en `127.0.0.1`, sin vistas públicas ni publicación; no registrar datos personales en los textos libres. Fotografías, archivos de permisos y controles de acceso quedan fuera de esta entrega.

No hay movimientos automáticos de inventario, planificación de siembra ni módulo de hidroponía. No se modificaron motor de Itzamná, firmware, COM6, dispositivos, zonas, sensores ni mediciones ambientales. No se instalaron dependencias. La entrega se detiene en Fase 2C-A.

## Archivos de esta entrega

- Backend: `backend/app/seed_models.py`, `seed_schemas.py`, `seed_routes.py`, integración en `backend/app/main.py`.
- Migraciones: `backend/migrations/versions/0004_seed_bank.py`, registro de metadatos en `backend/migrations/env.py`.
- Pruebas: `backend/tests/test_seeds.py`, ampliación acotada de rutas y revisión esperada en `backend/tests/test_phase_one.py`.
- Frontend Semillas: `frontend/src/seedApi.ts`, `pages/Seeds.tsx`, `components/SeedForms.tsx`, navegación en `frontend/src/App.tsx`, estilos acotados en `frontend/src/styles.css`.
- Lenguaje: `frontend/src/components/decisionLanguage.ts`, `components/DecisionMap.tsx`, `pages/Decisions.tsx`.
- Documentación: este informe, `README.md`, `AGENTS.md`, `docs/API.md` y `docs/MODELO_DATOS.md`.

## Simplificación de Semillas · 19 de octubre de 2026

Se simplificó exclusivamente la presentación de Semillas, conservando contratos, selección, backend, SQLite y migraciones. No se añadieron dependencias ni se modificaron Decisiones, Itzamná, firmware, COM6 o telemetría.

- Entrada «Agregar semillas» con la explicación de lote y dos opciones: «Tengo semillas» (registro físico) y «Quiero estudiar semillas» (tipo hipotético existente, sin afirmar inventario).
- El formulario comienza con nombre, tipo e identificador. Sugiere un código breve editable con prefijo `SEM` o `EST` y 12 caracteres aleatorios derivados de UUID. Comprueba los códigos cargados; la validación única existente de la API sigue siendo la comprobación definitiva. Los identificadores anteriores no se reemplazan.
- El resto de los campos se conserva en «Origen y uso responsable», «Cómo se conservan» y «Más información», con ayudas y ejemplos sin datos precargados. Cantidad y variedad son opcionales. Las cantidades hipotéticas se identifican como supuestos, sin presentarlas como existencias físicas.
- Pruebas y evaluación se ofrecen después de guardar. «Añadir o revisar pruebas» abre los campos existentes de germinación/viabilidad. Guardar y editar siguen usando el pasaporte completo y las versiones de la API actual.
- También se simplificó la consulta de fichas y versiones históricas con los mismos desplegables. El estado de autorización permanece visible. Un campo obligatorio dentro de un desplegable cerrado abre su sección al validar y recibe el foco.

Verificación: **115 pruebas de backend aprobadas**, **11 pruebas de frontend aprobadas** (8 del mapa existente y 3 de sugerencia de identificadores) y build correcto. La única advertencia del backend continúa siendo la deprecación de Starlette/AnyIO ya documentada.

Pruebas visuales en escritorio y móvil de 390 × 844: dos entradas diferenciadas, alta mínima física e hipotética, identificador editable, ausencia de cantidades y permisos automáticos, campos plegados, acceso posterior a pruebas y validación de unidad con su sección cerrada. Sin desbordamiento horizontal en móvil. Se restauró el tamaño de escritorio al finalizar.

Compatibilidad comprobada en la base temporal de QA anterior: guardar una ficha existente conserva íntegramente su pasaporte (incluido identificador y permiso), evaluaciones, decisiones y versiones previas, y añade únicamente la nueva revisión esperada. No se escribieron ejemplos en la base operativa.

Archivos: `frontend/src/components/SeedForms.tsx`, `frontend/src/components/seedRegistration.ts`, `frontend/src/pages/Seeds.tsx`, estilos acotados en `frontend/src/styles.css`, `frontend/tests/seed-registration.test.mjs` y este informe. Capturas locales excluidas de Git: `output/qa/semillas-simplificadas-escritorio.jpg` y `output/qa/semillas-simplificadas-movil.jpg`.

Para abrirlo, iniciar los servidores habituales y visitar `http://127.0.0.1:5173/semillas`; basta actualizar la página si ya estaban abiertos. Para repetir la verificación desde la raíz:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
node --test frontend/tests/seed-registration.test.mjs frontend/tests/decision-map.test.mjs
```

## Información real e investigación sin inventario · 19 de octubre de 2026

### Problema revisado y decisión sobre SQLite

`source_kind` combinaba presencia física con carácter hipotético. La interfaz etiquetaba automáticamente la investigación sin semillas como hipotética, aunque podía proceder de artículos o documentos auténticos. También faltaba distinguir la procedencia de cada dato: documentación, observación, instrumento, cálculo o simulación.

No bastaba renombrar la interfaz, pero **no hace falta una migración de SQLite**. Los pasaportes ya son JSON validado y versionado. Se ampliaron sus contratos y presentación con clasificación y evidencias explícitas, sin reconstruir tablas ni cambiar `seed_models.py` o migraciones. La base permanece en `0004_seeds`; no se aplica ninguna migración nueva ni se toca la base operativa para la verificación. La condición de respaldo previo a migración no se activa.

### Corrección entregada

- «Cultivos en estudio»: ficha documental de una especie candidata, sin inventario físico. Puede contener información científica auténtica; la existencia o ausencia de semillas no determina la veracidad de los documentos.
- «Semillas disponibles»: grupos de semillas recibidos o conservados físicamente. Cantidad desconocida sigue siendo nula; no se deduce de artículos, pruebas o permisos.
- «Pruebas y observaciones»: información con tipo de procedencia, asunto, contenido, fecha, método y fuente. Valores numéricos requieren unidad. Mediciones transcritas identifican instrumento y registro; no se conectan a dispositivos ni escriben en telemetría.
- «Simulación»: resultados de escenarios supuestos. Requiere supuestos del escenario y de cada resultado, junto con fecha, procedimiento y fuente de la ejecución. No admite información documental presentada como resultado simulado.
- El panel «Información y respaldo» muestra las fuentes declaradas, datos pendientes y tipos de evidencia por separado. No declara validación científica automática. Los cálculos ponderados de evaluación siguen siendo cálculos, con sus puntuaciones humanas; no se presentan como mediciones.
- Se aprovechan `information_source`, `provenance`, observaciones y el historial existente. Si falta fecha, método o fuente para un dato nuevo, se puede conservar la nota pendiente sin inventar metadatos. Una referencia general no se extiende automáticamente a todos los datos de la ficha.

Los campos nuevos son `record_kind` (`inventory`, `study`, `simulation` o nulo), `evidence` y `scenario_assumptions`. `source_kind` sigue siendo un indicador legado para compatibilidad: el valor interno `hypothetical` no determina la validez científica; los estudios nuevos se identifican por `record_kind: study`. Los consumidores nuevos deben leer la clasificación explícita. Los contratos están documentados en `docs/API.md`.

### Compatibilidad e integridad

Los registros, identificadores, cantidades anteriores, permisos, evaluaciones, decisiones y snapshots no se reescriben al consultar. Una ficha antigua marcada como no física se muestra «Ficha anterior · por revisar»; no se supone que sea documental ni simulada. Clasificarla requiere una edición humana explícita y crea una nueva revisión. Cantidades heredadas se conservan sin llamarlas inventario; no se permiten nuevas cantidades de existencias en estudios o simulaciones. No se convierte una ficha sin inventario en semillas físicas.

Los clientes anteriores que omiten los campos nuevos al editar conservan la procedencia nueva ya almacenada. Las comparaciones separan inventario, estudios, simulaciones y fichas antiguas sin clasificar, con el mismo cálculo de puntuaciones y las mismas reglas de revisión/permisos. Las evaluaciones y decisiones históricas siguen consultables. Los UUID estables quedan preparados para futuras relaciones con cultivos; no se implementa hidroponía.

### Cómo registrar una investigación auténtica

1. Reiniciar el backend para cargar los contratos nuevos y actualizar la página `http://127.0.0.1:5173/semillas`. No borrar ni reconstruir la base.
2. Elegir «Cultivos en estudio», escribir el nombre y guardar el identificador sugerido o uno propio. No se requiere cantidad de semillas ni sensores.
3. En «Más información», registrar nombre científico y fuente general sólo cuando estén documentados. Dejar desconocidos como «Sin datos». Los permisos de uso del material permanecen pendientes hasta su documentación.
4. Abrir «Pruebas y observaciones» → «Añadir información con fuente» → «Información documental». Transcribir el dato, referencia bibliográfica/DOI/página, fecha de consulta y método de revisión. Si hay valor numérico, indicar la unidad. No se precarga bibliografía ni se inventan resultados.
5. Si después se documenta una observación, un registro instrumental externo, un cálculo o un resultado simulado, elegir su tipo y registrar su procedencia propia. Los resultados simulados se mantienen identificados como tales.
6. Guardar y revisar la evidencia en «Información y respaldo». La ficha muestra que no hay existencias registradas. Las semillas que se reciban posteriormente se registran por separado en «Semillas disponibles»; la investigación no se convierte automáticamente en inventario.

### Verificación

**135 pruebas del backend aprobadas**, incluidas 20 verificaciones nuevas de investigación sin inventario, procedencia por tipo, metadatos obligatorios, unidades, supuestos, reinicio, JSON anterior sin reescritura, clasificación humana, separación de comparaciones y compatibilidad de clientes. **14 pruebas del frontend aprobadas**, incluidas clasificación de estudios, no conversión de registros antiguos, identificadores y mapa. Build correcto. Persiste únicamente la advertencia de deprecación de Starlette/AnyIO ya registrada.

Se comprobó en navegador con SQLite temporal: alta documental sin cantidad/autorización, registro y reapertura de fecha/método/fuente, campos pendientes y clasificación antigua por revisar. La vista móvil de 390 × 844 no presenta desbordamiento horizontal. Se restauró el tamaño de escritorio. La captura `output/qa/semillas-investigacion-documental.jpg` pertenece a QA, declara que no contiene datos científicos de una especie y está excluida de Git. No se introdujeron semillas ni resultados en `backend/data/`.

Se modifican contratos y rutas de Semillas, frontend, pruebas y documentación. No se alteran Itzamná, ESP32, firmware, COM6, telemetría, migraciones ni dependencias. La aplicación prepara el registro de evidencia; no valida documentos externos ni sustituye la revisión científica humana.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
node --test frontend/tests/seed-information.test.mjs frontend/tests/seed-registration.test.mjs frontend/tests/decision-map.test.mjs
```


## Preparación opcional de alojamiento · 25 de octubre de 2026

Por solicitud del usuario se prepara su copia `ject1990/lekil-kuxlejal` para
Render, en la rama `deploy/render`. El despliegue efectivo y su facturación
requieren crear el servicio en la cuenta del usuario; esta entrega no acredita
una publicación ya funcionando en Render.

Se añade una entrada ASGI independiente (`app.hosted:create_hosted_app`), que
sirve exclusivamente el build de React y protege interfaz y API con HTTP Basic
sobre HTTPS. Requiere credenciales explícitas y un SQLite absoluto dentro del
directorio persistente existente. La comprobación `/api/health` permanece pública
sin exponer registros. Las escrituras ajenas al origen y la entrada serial
remota están bloqueadas. El inicio local y los contratos de datos se conservan.

`render.yaml` define un servicio Python, un disco de 1 GB y secretos que el
usuario introduce en Render. El build incluye React y el motor de referencia
original, con Python 3.12 y las restricciones de dependencias existentes. No
se modifica Itzamná ni se incorpora Docker o un SDK de nube. Los despliegues
automáticos quedan apagados. `docs/RENDER.md` detalla la creación, comprobación,
respaldo lógico manual y límites del acceso compartido.

Verificación en Linux con Python 3.12.14: **180 pruebas de backend aprobadas**
(135 existentes y 45 de alojamiento), **14 pruebas de frontend aprobadas** y
compilación de producción correcta. Se ejecutaron los pasos equivalentes de
`scripts/check.ps1`; ese script usa ejecutables de Windows, no disponibles en
este entorno Linux. Las bases y credenciales de QA son temporales. Se comprobó
la persistencia tras reinicio, rechazo de accesos sin contraseña, entradas
malformadas, rutas privadas, escrituras de otro origen y configuración incompleta.

En navegador se verificaron ocho rutas con recarga, API autenticada real con
SQLite temporal, ausencia de errores JavaScript y vista móvil de 390 × 844 sin
desbordamiento horizontal. No se añadieron registros a la base operativa.
Persiste la advertencia conocida de deprecación de Starlette/AnyIO.

Límites: acceso con clave compartida, sin usuarios individuales ni roles; sin
lectura USB remota ni control físico; sin tarea de respaldo automático. Los
512 MB son una configuración inicial pendiente de medir con carga real en
Render, no una garantía de capacidad. La configuración aún debe probarse en
la infraestructura contratada y con HTTPS del proveedor.


## USB directo desde la web · 25 de octubre de 2026

El servicio de Render anterior ya fue creado por el usuario y se comprobó
`/api/health` con API y base conectadas. A solicitud expresa posterior se añade
Web Serial sólo a la interfaz alojada. Esto sustituye la limitación de lectura
USB remota descrita en la preparación inicial; no altera los informes históricos.

La conexión requiere un clic y permiso del navegador. Se conserva el protocolo
serial de diagnóstico existente y el firmware, sin sensores nuevos ni actuación.
La API protegida recibe líneas originales y valida identidad, secuencia, tamaño,
fecha y origen; sólo el backend persiste los datos. La entrada interna del lector
Python sigue cerrada en alojamiento y el arranque local no expone las nuevas rutas.
Se documenta la excepción autorizada de acceso USB en AGENTS.md y su uso completo
en docs/RENDER.md. No se modifica Itzamná, Semillas, migraciones ni dependencias.

Validación: 193 pruebas de backend y 17 de frontend aprobadas, compilación de
producción correcta. Chromium con USB simulado, API real y SQLite temporal verifica
lectura, navegación, desconexión, reconexión, falta de internet, caducidad, errores
de formato, cancelación, puerto ocupado y ausencia de Web Serial. Los datos
sintéticos de QA no entraron en la aplicación publicada. Persiste únicamente la
advertencia de deprecación Starlette/AnyIO ya conocida.

Pendiente de la persona usuaria: subir los archivos a deploy/render, desplegar
el commit en el mismo servicio y verificar con su placa física. No se ha medido
un USB real desde este entorno. La temperatura/humedad permanecen sin datos
porque el firmware actual sólo identifica la placa y emite heartbeat.
