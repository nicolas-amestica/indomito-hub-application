# Revisión de diseño — Migración del módulo Inbox

## Hallazgos

1. **HIGH — El authorizer todavía acepta JWT sin firma válida y el diseño no elimina ese bypass.**
   - **Dónde:** `IAM funcional y authorizer > Corrección del Lambda Authorizer`.
   - **Problema:** el diseño corrige `methodArn.includes(entry.endpoint)`, pero da por supuesto que todo JWT ya fue validado con HMAC-SHA256. En el código real, `generateRequestPolicy()` llama `generateCustomTokenPolicy(..., true)` y, si ninguna firma valida, `allowUnsignedFallback` usa `jwt.decode()` y acepta el body cuando trae `allowances` y `username` o `professionalRun`. Los endpoints privados de Inbox usarán precisamente el authorizer REQUEST del HTTP API; un atacante puede fabricar un token con `access` y allowances Inbox sin conocer el secreto. Esto contradice deny-by-default y vuelve insuficiente cualquier alta IAM de `COM/INBOX`.
   - **Fix concreto:** eliminar el parámetro y la rama `allowUnsignedFallback`; la llamada REQUEST debe quedar `return generateCustomTokenPolicy(sanitizedToken, methodArn, "[AUTH][REQUEST]");`. Agregar tests que exijan Deny para `alg:none`, firma aleatoria, payload modificado y token legacy decodificable, y Allow solo con una firma obtenida desde los secretos de verificación.

2. **HIGH — Los contratos HTTP/AsyncAPI siguen incompletos y los archivos declarados como canónicos no existen.**
   - **Dónde:** `Contratos HTTP frontend/backend`, `Eventos` y `Pruebas y gates`.
   - **Problema:** solo se definen `ConversationSummary`, `ConversationMessage` y `SendState`. Faltan schemas completos de lista, detalle, páginas anteriores/delta, presign y `requiredHeaders`, mutaciones, ticket, resolución, operaciones masivas y payload de cada evento realtime. Tampoco se define cómo aparecen `pageInfo`, `nextCursor` y `unreadTotal` respecto de `{data}`. El texto afirma que AsyncAPI “cierra” los payloads, pero no existe `services/api-inbox/asyncapi.yaml` ni su copia publicada; tampoco existe el fragmento OpenAPI Inbox. Frontend, Go y WebSocket tienen varias interpretaciones válidas y no pueden implementar ni ejecutar contract tests contra una promesa futura.
   - **Fix concreto:** crear los contratos canónicos antes del código y referenciarlos desde el diseño. Como mínimo, fijar una única forma, por ejemplo `GET /conversaciones -> {data: ConversationSummary[], pageInfo: PageInfo, nextCursor: string|null, unreadTotal:number}` y `GET /conversaciones/{telefono} -> {data:{conversation:ConversationSummary,messages:ConversationMessage[],nextCursor:string|null,hasMore:boolean,nonTerminalSends:SendState[]}}`; cerrar request/response/status/error de cada operación y el schema exacto de los ocho eventos AsyncAPI. CI debe fallar si las copias publicadas no tienen el mismo SHA-256.

3. **HIGH — El cursor de búsqueda no puede continuar el resultado global ordenado con la información especificada.**
   - **Dónde:** `GET /conversaciones` y `Búsqueda exacta sin n-gramas`.
   - **Problema:** para obtener total exacto y ordenar por actividad, la primera petición agota las 16 particiones, hace BatchGet de todos los matches y ordena el conjunto. En ese punto, un cursor que solo conserva “estado de las 16 particiones” queda al final de todas ellas y no contiene los candidatos ordenados restantes. Reconsultar en página 2 permite que cambios de actividad reordenen resultados, mientras `indexEpoch` solo se describe para cambios de alias; codificar hasta 19.800 IDs restantes tampoco cabe razonablemente en un cursor. Por tanto, `pageInfo` estable y páginas sin duplicados/omisiones no están implementablemente definidos.
   - **Fix concreto:** materializar un snapshot de búsqueda de dos minutos. La primera petición consulta shards, obtiene y ordena los teléfonos, y persiste páginas bajo `SEARCH_RESULT#<sessionId>` ligadas a `userId`, hash de query y expiración; el cursor firmado lleva solo `sessionId`, `offset/page`, hash e `issuedAt`. Las siguientes páginas consultan ese snapshot. Definir cleanup TTL, límite por usuario, costo y condición de 503 antes de adoptar el esquema. Si no se acepta materialización, retirar la promesa de estabilidad y presentar un diseño alternativo completo antes de implementar.

4. **HIGH — Las operaciones masivas no son factibles dentro de una petición Lambda para el volumen que el propio diseño admite.**
   - **Dónde:** `PATCH /conversaciones:marcar-leidas`, `PATCH /conversaciones:recalcular-no-leidas`, persistencia y manejo de errores.
   - **Problema:** el diseño dimensiona hasta 20.000 conversaciones, pero conserva respuestas síncronas `{updated}` y `{cleared,keptUnread,unchanged}`. Marcar todas puede requerir decenas de miles de actualizaciones de metadata/sesión/índice y recalcular requiere además consultar el último mensaje de cada conversación. “Reintentar si falla un lote” no define checkpoint, límite, atomicidad del conteo ni cómo evitar responder éxito parcial antes del timeout de API Gateway/Lambda.
   - **Fix concreto:** convertir ambas acciones en operaciones paginadas por worker: el PATCH crea condicionalmente `BULK#<operationId>`, encola el primer cursor y responde `202 {data:{operationId,state:'pending'}}`; cada worker procesa un lote acotado, persiste checkpoint y conteos, y encola el siguiente hasta `committed|failed`. Agregar `GET /operaciones-inbox/{operationId}` y evento final; el frontend mantiene loading, impide doble ejecución y solo limpia/reconcilia badges al completar. Definir tamaño de lote, idempotency key, retry/DLQ y prueba con 20.000 ítems.

5. **MEDIUM — La retención de 90 días no está definida para escrituras destino y el atributo TTL es internamente inconsistente.**
   - **Dónde:** `Persistencia DynamoDB`, `Ticket realtime`, migración y casos límite.
   - **Problema:** el legacy confirma `ttl` de 90 días para mensajes, WAMID y fila/lista, y renueva el TTL de sesión/lista con actividad. El diseño solo limita qué se migra; no dice qué expiración reciben mensajes y conversaciones creados después del corte. Además declara TTL de tabla `expiresAt`, pero el ticket persiste `expiresAtEpoch`, por lo que DynamoDB nunca eliminará esos tickets aunque la condición temporal los rechace. No están cerradas las expiraciones de SEARCH, SEND, UPLOAD, conexiones y OUTBOX.
   - **Fix concreto:** usar un solo atributo numérico `expiresAt` en todos los ítems efímeros y en las condiciones. Documentar una matriz obligatoria: mensaje y WAMID `createdAt + 90d`; metadata/list/search `now + 90d` renovado en cada actividad; META_MSG `+7d`; ticket según la vigencia contractual; upload según el presign; conexión según su lease. Definir explícitamente si SEND/OUTBOX terminales se retienen o expiran y agregar tests de TTL y renovación.

6. **MEDIUM — El rollback por GSI omite cómo indexar todas las escrituras posteriores al corte.**
   - **Dónde:** `gsi-migracion-actualizacion-index` y `Rollback`.
   - **Problema:** el índice se describe como sparse “por run/updatedAt” y la migración inicial etiqueta el run, pero las mutaciones normales, mensajes entrantes y conversaciones nacidas después del cutover no tienen reglas para poblar esa partition/sort key. `target-to-legacy --since <cutover>` puede omitir exactamente los datos nuevos que obligan a ejecutar el rollback controlado.
   - **Fix concreto:** hacer que cada transacción que cambie una conversación actualice su META con `gsiMigrationPk='INBOX_DELTA'` y `gsiMigrationSk='<updatedAt>#<phone>#<generation>'`; el reversor consulta ese PK desde el watermark y luego hace Query de cada `CONV#phone`. Alternativamente, persistir un change log inmutable equivalente. Probar creación, alias, unread, delete/recreate, mensaje y delivery posteriores al corte, y demostrar que todos aparecen una sola vez en el delta inverso.

7. **MEDIUM — Las variables SSM no tienen schemas ni una trazabilidad legacy reproducible campo a campo.**
   - **Dónde:** `Variables de environments/.env.dev` y `Obtención segura desde legacy`.
   - **Problema:** se dan nombres/path, pero `agent-config`, `asset-config` y `meeting-config` siguen como “JSON” sin campos, tipos, defaults ni validación; “bloque environment y helpers” no identifica el origen exacto de cada valor. Tampoco se resuelve expresamente que el calendario destino existente usa `/google/calendar-id` de tipo `String`, mientras la regla del proyecto exige configuración runtime en SecureString. Dos implementadores pueden crear JSON incompatibles o copiar PII/IDs legacy al lugar equivocado.
   - **Fix concreto:** agregar schemas exactos y una tabla `campo destino -> origen legacy -> método de obtención`. Una elección concreta coherente con el código inspeccionado es: `gemini-config={apiKey,model,temperature,topP}` desde `/pa/{stage}/gemini-api-key` y `helpers/gemini-agent.js`; `agent-config={enabled,debounceMs,rateLimitMax,rateLimitWindowSeconds,maxMessageLength,maxHistoryTurns,enabledChannels}` desde `serverless.yml`, `agent-debounce.js` y `ejecutar-agente-v1.js`; `asset-config={budgetPrefix,certificateKey}` desde `tools/buscar-presupuestos.js` y `helpers/send-certificado-sernatur.js`; `meeting-config={calendarId,timeZone,defaultGuestEmails,defaultHostSk,defaultHostName,durationMinutes,minAdvanceMinutes}` desde `serverless.yml` y `meeting-scheduling-rules.js`. Mantener valores/PII solo en `.env.dev` ignorado o transferencia SSM→SSM, validar JSON antes de `put-parameter` y no imprimirlo.

8. **MEDIUM — La reserva de adjunto no queda ligada al usuario ni al teléfono y falta cerrar CORS/validación del caption.**
   - **Dónde:** `POST /adjuntos-inbox:preparar`, `Adjuntos con integridad` e infraestructura S3.
   - **Problema:** preparar no recibe teléfono y el diseño dice que `UPLOAD#clientMessageId` guarda teléfono “opcional”; tampoco guarda `userId`. La confirmación bajo otro teléfono podría consumir una reserva válida si conoce `s3Key/clientMessageId`. Además el bucket solo se describe con CORS PUT/HEAD, sin exigir los headers que la firma requiere, y `caption` no tiene límite. Esto deja decisiones de seguridad y un posible fallo de preflight al implementador.
   - **Fix concreto:** incluir `phone` en preparar (o moverlo a `/conversaciones/{telefono}/adjuntos:preparar`), persistir `ownerUserId` desde el authorizer y exigir coincidencia exacta de owner, phone, key y clientMessageId al consumir. Definir `caption` trim `0..4096`. El CORS del bucket debe permitir exactamente `Content-Type`, `x-amz-meta-client-message-id` y `x-amz-checksum-sha256` para los orígenes Hub, y tests deben cubrir consumo cruzado, preflight, reserva vencida y doble confirmación.

9. **MEDIUM — El composer y la carga incremental no replican varios comportamientos legacy confirmados.**
   - **Dónde:** `UI/UX equivalente`, `Composer` y `Estado, cache, paginación y scroll`.
   - **Problema:** el diseño omite por completo el popover de 40 emojis, inserción en la selección y restauración de foco. También amplía el selector manual a OGG/WebM aunque legacy solo acepta `.pdf,image/*`, limita adjuntos a tres en paralelo aunque legacy usa `mergeMap` sin límite, y elimina el fallback final `audio/webm`. Finalmente carga páginas adicionales de 200, mientras legacy solicita 20 después de la primera carga de 200. Son cambios de lógica/comportamiento no incluidos entre las excepciones de seguridad o accesibilidad aceptadas por la propia definición de equivalencia.
   - **Fix concreto:** especificar la lista exacta de 40 emojis y el algoritmo `selectionStart/selectionEnd -> setValue -> restaurar caret/foco`; mantener picker manual PDF/JPEG/PNG/GIF/WebP y reservar OGG/WebM para archivos creados por MediaRecorder; mantener fallback WebM; retirar el límite de concurrencia o registrarlo como desviación aprobada. Para conservar el contrato de página fija 200 sin alterar UX, cachear la página backend y revelar 20 filas por cada umbral de scroll antes de pedir la siguiente página.

10. **MEDIUM — Los envíos `recovering/uncertain` no pueden sobrevivir una recarga como promete el diseño.**
    - **Dónde:** `Composer`, `SendState` y `GET /conversaciones/{telefono}`.
    - **Problema:** el único endpoint de estado requiere un `clientMessageId` que vive en la burbuja optimista del store. Al recargar el navegador o recrear la feature se pierde ese ID; el detalle solo describe mensajes persistidos y un envío `uncertain` aún no tiene `MSG#`. Por tanto, la burbuja no puede “quedar visible hasta resolución operativa” ni consultar manualmente su estado después de reload.
    - **Fix concreto:** incluir `nonTerminalSends` de esa conversación en la respuesta de detalle, o agregar `GET /conversaciones/{telefono}/envios?state=non-terminal`, consultado siempre al abrir el chat. Cada elemento debe incluir clientMessageId, preview/attachment seguro, createdAt y SendState; el store reconstruye la burbuja y reanuda polling solo para estados recuperables. Probar reload en `provider_pending`, `recovering` y `uncertain`.

## Verified Assumptions

- El Inbox legacy monta un shell con hijo `:phone` y usa la ruta funcional `comunicaciones/conversaciones`.
- Los endpoints legacy de lista, detalle, respuesta, presign, adjunto, alias, unread, marcar todas, recalcular y delete están confirmados en `api-whatsapp-agent`; webhook y WebSocket también viven allí.
- El flujo Inbox legacy inspeccionado usa Query/Get/Put/Update/Delete; no se encontró DynamoDB Scan.
- El perfil funcional es `ADMIN`; `ADM` corresponde al módulo padre Administración. La fuente funcional de módulos/perfiles/permisos es `UsuariosTable` mediante `api-identity`, no el repo authorizer.
- `api-identity` genera `access[]` por endpoint y allowance, y un LV2 solo es efectivo si su LV1 tiene `r`; asignar `COM r` e `INBOX crud` a `PFL#ADMIN` es coherente con el modelo real.
- `lambdautil.UserIDFromContext` lee `requestContext.authorizer.lambda`; ampliar el helper para los demás campos tipados es factible y evita validar JWT en `api-inbox`.
- El authorizer actual usa `methodArn.includes(endpoint)` y además contiene el fallback de token decodificado sin firma válida para eventos REQUEST.
- El WebSocket legacy transporta JWT en query string; sustituirlo por un ticket de un uso ligado a identidad/scope/teléfono es una mejora necesaria.
- `.env.dev` de infraestructura está ignorado y `scripts/ssm-apply-securestring.ts` aplica parámetros sin imprimir valores; `secureOnly` evita llevar SecureString a CloudFormation.
- Los orígenes legacy de WhatsApp, Gemini, calendario, debounce, límites, assets y hosts están identificados en `serverless.yml` y helpers; los schemas destino aún no están definidos.
- El legacy usa 90 días para historial/lista/WAMID y siete días para dedupe Meta.
- El legacy contiene 40 emojis, picker manual PDF/imágenes, caption solo en el primer adjunto, concurrencia sin límite explícito y fallback de grabación WebM.
- No existen todavía el fragmento OpenAPI ni el AsyncAPI Inbox declarados como contratos canónicos.
- El diseño no propone Scan, no revalida JWT dentro del microservicio y no copia el secreto JWT legacy.

## Unverified/Wrong Assumptions

- **Wrong:** que el authorizer REQUEST actual exija siempre una firma HMAC válida.
- **Wrong/incompleto:** que el estado de las 16 particiones permita continuar un resultado ya agotado, globalmente ordenado y estable.
- **Wrong/incompleto:** que un GSI sparse por run capture por sí solo escrituras nuevas posteriores al corte.
- **Wrong/incompleto:** que un ticket con `expiresAtEpoch` sea eliminado por una tabla cuyo atributo TTL es `expiresAt`.
- **Wrong/incompleto:** que un envío uncertain pueda recuperarse tras reload con solo `GET /envios-inbox/{clientMessageId}`.
- **Unverified:** existencia y título efectivos de `PFL#ADMIN`, `COM` e `INBOX` en DEV/PRD; la investigación no pudo consultar AWS por sesión SSO expirada.
- **Unverified:** existencia, tipo, versión y contenido válido de los parámetros SSM legacy; no fueron descifrados.
- **Unverified:** cuenta WABA, número Meta, permisos del token y capacidad de mover el webhook sin una ventana de doble escritor.
- **Unverified:** que la búsqueda exhaustiva de 20.000 conversaciones cumpla p95/p99, memoria, timeout y costo; el prototipo sigue siendo un gate pendiente.
- **Unverified:** disponibilidad/cuota/estabilidad del modelo `gemini-3.1-pro-preview-customtools` en el momento del corte.
- **Unverified:** paridad visual y accesibilidad ejecutada en claro/oscuro y 320/390/tablet/escritorio; todavía no existen baselines ni resultados Playwright/Axe.
- **Unverified:** grabación/reproducción OGG/WebM en Safari iOS/Android y comportamiento real del PUT prefirmado con los nuevos headers CORS.

## Derivación mecánica

El veredicto se deriva exclusivamente en `design-review.json` contando los hallazgos HIGH y MEDIUM.
