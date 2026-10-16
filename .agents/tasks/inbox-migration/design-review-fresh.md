# Revisión fresca del diseño — Migración Inbox

## Veredicto

**APPROVED**. La revisión se repitió contra el `design.md` vigente después de la última corrección interrumpida. No quedan hallazgos HIGH ni MEDIUM abiertos.

## Evidencia de cierre

1. El mutex bulk es global por aplicación y tipo; callers distintos convergen en la operación activa.
2. La materialización limita cada chunk a 98 targets y confirma targets, checkpoint y continuación en una sola transacción de hasta 100 acciones.
3. OUTBOX y SEND poseen due-queues base particionadas, lease y recuperación por `Query`; realtime ordena el batch, persiste gaps y drena secuencias contiguas.
4. El rollback preaplica WAMID/SEND antes de cambiar el callback y luego procesa un delta monotónico; Calendar y adjuntos tienen reglas de compatibilidad y checksum.
5. La migración define transformación campo a campo, ULID determinista, checkpoint con `LastEvaluatedKey`, idempotencia y manifiestos JCS para ambos sentidos.
6. Los schemas separan adjuntos salientes de hasta 7 MiB del historial entrante de hasta 16 MiB y enumeran OGG/WebM.
7. El importador escribe `SSM_GOOGLE_CALENDAR_OAUTH` al parámetro destino existente con schema cerrado y operación todo-o-nada.
8. El frontend incorpora `canPerform`, directiva estructural y matriz completa de allowances `c/r/u/d`, manteniendo el backend como autoridad.
9. AsyncAPI usa server WSS parametrizado por `apiId` y `stage`, canal relativo y binding de ticket, con comparación contra `WebSocketUrl`.
10. La sincronización contractual fija credencial read-only, repositorio, path, ref y `servicesCommit` verificable.
11. El authorizer incluye contrato emisor-verificador, negativos criptográficos, smoke DEV, observación y rollback de alias.
12. `CONV_COUNT` es transaccional, tiene alarmas y preserva siempre inbound al superar capacidad; lista y bulk degradan con 503 sin `Scan` ni pérdida.

## Riesgos que permanecen como gates de implementación

No son defectos del diseño, pero deben demostrarse antes del corte: rendimiento con el máximo configurado, costos aprobados, paridad visual multi-viewport/tema, codecs móviles, credenciales y parámetros externos, callback Meta, cuotas de proveedores y smoke criptográfico DEV. Ninguno autoriza desplegar ni cortar producción durante la construcción.
