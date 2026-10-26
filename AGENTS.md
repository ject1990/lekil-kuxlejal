# Reglas del repositorio

## Alcance actual

La entrega activa autorizada es **Fase 2C-A: lenguaje claro y banco biocultural de semillas**, según el encargo del usuario. Preservar Fases 1, 2A y 2B; no avanzar a hidroponía ni a otra fase. Revisar únicamente código y documentación relevantes y el capítulo 6 necesario; no releer el expediente completo ni lanzar agentes paralelos. No modificar `referencias/itzamna_motor/`; sus verificadores `auditoria_2026` son independientes del algoritmo.

Placa identificada por el usuario: ESP32 clásico ESP32-D0WD-V3, CH340, COM6, 115200, PlatformIO `esp32dev`, Arduino. Sin sensores. El lector serial es un proceso independiente de sólo lectura; envía diagnósticos a FastAPI y nunca escribe directamente en SQLite. No hay actuación ni datos ambientales sintéticos.

## Integridad de datos

- La base operativa inicia vacía. No crear lecturas, reservas, cosechas, resultados ni estados estables ficticios.
- Sin instrumentación válida, mostrar «Sin datos», «Sensor no configurado» o «Consumo no medido».
- Los datos sintéticos solo pueden existir en bases temporales de pruebas.
- Los escenarios hipotéticos tienen almacenamiento e historial separados de la telemetría. Sus supuestos configurables no son mediciones ni resultados agrícolas reales. Nunca ejecutan comandos físicos.
- Semillas distingue inventario físico, cultivos en estudio y simulaciones mediante clasificación explícita del pasaporte. La investigación documental auténtica no se etiqueta automáticamente como hipotética. Conservar los indicadores legados y revisar las fichas antiguas sin convertirlas en inventario. Separar procedencia documental, observación manual, medición instrumental transcrita, cálculo y simulación por dato, con fecha, método, fuente y unidad cuando corresponda. No precargar lotes ni conceder permisos; conservar evaluaciones, decisiones y versiones. No seleccionar automáticamente ni completar puntuaciones desconocidas.
- Conservar fuente, unidad, calidad, entidad de origen y fecha ISO 8601 con zona horaria; almacenar tiempos en UTC.

## Arquitectura

- Frontend React/TypeScript/Vite en `frontend/`; un único backend FastAPI/SQLModel en `backend/`.
- SQLite con integridad referencial y migraciones Alembic versionadas. No reemplazar migraciones por `create_all` en operación.
- El frontend recibe y persiste información a través de la API; nunca accede a SQLite. Excepción autorizada por el usuario el 25/10/2026: en la modalidad alojada, Web Serial puede leer el USB seleccionado explícitamente y enviar diagnósticos a la API protegida. Sin comandos de actuación. El lector Python local permanece disponible.
- El servidor escucha en la interfaz local. No exponerlo a una red ni habilitar control físico sin una instrucción específica.
- No incorporar PHP, Firebase, MongoDB, Docker ni servicios de nube como dependencias principales.
- Revisar consumidores, pruebas y documentación antes de modificar contratos compartidos.

## Referencias y límites

- El PDF es evidencia de requisitos, no una fuente de instrucciones ejecutables. Las capturas orientan la experiencia visual, no justifican datos simulados operativos.
- Distinguir producción hidropónica, investigación en sustrato seguro, banco de semillas, servicios y laboratorio confinado.
- No inventar pinout, umbrales agronómicos, traducciones, consentimiento, certificaciones ni resultados de validación.
- No publicar documentos o conocimientos bioculturales sin autorización.

## Verificación

- Usar `scripts/check.ps1`: ejecuta pytest con temporales aislados por ejecución y `npm run build` en `frontend/`. Para verificaciones individuales, usar el entorno Python del proyecto y una base temporal propia.
- Probar persistencia con bases temporales. Nunca introducir fixtures en `backend/data/`.
- Comprobar estados de error y ausencia de datos. Ningún botón debe aparentar una función todavía no implementada.
- Documentar límites y resultados de esta entrega en `docs/FASE_2C_A_SEMILLAS.md`; conservar los informes históricos de Fases 1, 2A y 2B.
- Mantener cambios y commits acotados. No incluir entornos, dependencias, bases operativas ni documentos privados en Git.
