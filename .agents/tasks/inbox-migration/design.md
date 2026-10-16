# Diseño técnico — Migración del módulo Inbox

## Visión general

La migración reproduce en Indómito Hub el comportamiento observable del Inbox legacy: bandeja, búsqueda, filtros, conversación, historial, composer, adjuntos, audio, estados de entrega, tiempo real, agente y herramientas. No se copia código legacy: se reimplementa con Angular 22 y el paradigma backend endpoint-per-function. La feature es cross-repo: `app-ngx-hub` contiene la UI; `services` incorpora `api-inbox`, migración e IAM funcional; `infrastructure` aprovisiona DynamoDB, S3, SSM y WebSocket; `authorizer` corrige la validación JWT y protege las rutas; `orchestrator` publica OpenAPI/AsyncAPI y runbooks.

El perfil **Administrador** usa el código real `ADMIN`; `ADM` es el módulo padre Administración y no es un perfil. Inbox mantiene la jerarquía legacy LV1 `COM` (**Comunicaciones**) y LV2 `INBOX` (**Conversaciones**) bajo `/comunicaciones/conversaciones`.

No se permiten desviaciones de UIX, lógica o comportamiento legacy salvo estas excepciones aprobadas y obligatorias: JWT siempre firmado, ticket WebSocket efímero en lugar de JWT en URL, idempotencia y atomicidad donde legacy permitía escrituras parciales, límite de 20 adjuntos por lote, evento de término de operaciones masivas, HTML accesible y correcciones mínimas de contraste WCAG AA. Toda excepción visual adicional requiere evidencia y aprobación en el manifiesto de paridad.

## Stack tecnológico bloqueado

- **Frontend:** Angular 22.1 standalone, TypeScript 6, Signals, `inject()`, `ChangeDetectionStrategy.OnPush`, Reactive Forms tipados, PrimeNG 22.1, Tailwind CSS 4.3, Angular CDK 22, RxJS 7.8, Vitest 4 y Playwright 1.56.1.
- **Backend:** Go 1.25, Echo v4, AWS SDK Go v2, Lambda ARM64 `provided.al2023`, Serverless Framework v4, DynamoDB, S3, SSM, SQS FIFO, DynamoDB Streams, API Gateway Management API, AWS Transcribe, zap y ULID.
- **Agente:** cliente HTTP Go inyectable para Gemini `generateContent`, function calling, prompt y knowledge base versionados.
- **Infraestructura:** TypeScript 5, Serverless Framework v4 y CloudFormation en `us-east-1`; recursos on-demand y Free Tier cuando exista una opción funcional.
- **Contratos:** OpenAPI 3.1 JSON y AsyncAPI 3.0 YAML.

## Arquitectura e integración

```text
app-ngx-hub
  ├─ Bearer JWT → HTTP API compartido → Lambda Authorizer → api-inbox
  ├─ PUT prefirmado sin Authorization → InboxTemporaryBucket
  └─ ticket efímero → API WebSocket → rutas Lambda de api-inbox

Meta WhatsApp → webhook firmado → TransactWrite(datos + OUTBOX)
                                      ↓ DynamoDB Stream
                         router ordenado → SQS FIFO → workers
                                      ↓
                    DynamoDB/S3/Transcribe/Gemini/Calendar/Meta
                                      ↓
                    API Gateway Management API → app-ngx-hub
```

HTTP es la fuente de verdad. WebSocket reduce latencia; una reconexión, payload inválido o salto de secuencia provoca reconciliación HTTP. El Lambda Authorizer compartido es el único validador JWT: `api-inbox` no lee el Bearer, no decodifica JWT y usa exclusivamente la identidad inyectada en `requestContext.authorizer.lambda`.

El ownership WebSocket queda cerrado por recurso, sin dependencia circular. El nuevo stack de infraestructura se llama `indomito-hub-infra-websocket-${stage}` y `websocket/serverless.ts` es dueño de `AWS::ApiGatewayV2::Api` protocolo WEBSOCKET, del `Stage` `${stage}` con `AutoDeploy:true`, access logs redactados y throttling; por usar AutoDeploy **no existe** `AWS::ApiGatewayV2::Deployment`. Exporta outputs CloudFormation exactos `WebSocketApiId`, `WebSocketApiExecutionArn`, `WebSocketStageName`, `WebSocketUrl` (`wss://.../${stage}`) y `WebSocketManagementEndpoint` (`https://.../${stage}`). No conoce Lambdas ni crea rutas.

`services/api-inbox/serverless.ts` importa esos cinco outputs desde ese stack y es el único dueño de tres `AWS::ApiGatewayV2::Integration` tipo `AWS_PROXY` payload 2.0, las rutas `$connect`, `$disconnect`, `$default`, y las funciones destino. Crea tres `AWS::Lambda::Permission`, una por función/ruta, con principal `apigateway.amazonaws.com` y `SourceArn` exactos `${WebSocketApiExecutionArn}/${WebSocketStageName}/$connect`, `${WebSocketApiExecutionArn}/${WebSocketStageName}/$disconnect` y `${WebSocketApiExecutionArn}/${WebSocketStageName}/$default`. El Stage AutoDeploy de infraestructura publica cada cambio de ruta, por lo que el stack de servicio no crea ni actualiza Stage/Deployment. Solo `outboxworker` recibe `execute-api:ManageConnections` sobre `${WebSocketApiExecutionArn}/${WebSocketStageName}/POST/@connections/*`; ningún handler HTTP lo hereda. `WS_MANAGEMENT_ENDPOINT` recibe exclusivamente el output HTTPS y el frontend recibe `WebSocketUrl` por su configuración pública de build, nunca por `.env.dev` de secretos. Los tests de template comprueban API→Route→Integration→Lambda, permisos y ausencia de un segundo API/Stage. El orden exigido es infraestructura `websocket` → `api-inbox`; remover invierte el orden.

### Identidad del authorizer

Se modifica `libs/lambdautil/identity.go` del repo `services` y sus tests para exponer una única API:

```go
type AuthorizerIdentity struct {
    UserID      string
    Email       string
    RUT         string
    ProfileCode string
}

func IdentityFromContext(req events.APIGatewayV2HTTPRequest) (AuthorizerIdentity, error)
```

`UserID` es obligatorio, string recortado de 1 a 128 caracteres. Se toma primero de `userId`; solo si la clave no existe se acepta `sub`. Una clave presente con tipo no string, whitespace o exceso de longitud produce `AUTH_UNAUTHORIZED`, sin fallback. `email`, `rut` y `profileCode` son opcionales; ausentes se devuelven como `""`, pero si están presentes deben ser string, se recortan y se limitan respectivamente a 254, 32 y 64 caracteres; email se normaliza a minúsculas y profileCode a mayúsculas. Tipo inválido o límite excedido invalida todo el contexto. `UserIDFromContext` permanece por compatibilidad y delega en `IdentityFromContext`; todos los handlers nuevos usan la nueva función. Se prueban authorizer nil, mapa vacío, claves ausentes, tipo inválido, whitespace, límites, `userId` inválido con `sub` válido y contexto completo válido.

Los logs usan `traceId`, IDs de operación y `phoneHash`; nunca teléfono completo, JWT, ticket, firma, body, prompt, email, RUT, URL temporal ni secretos.

## Contratos canónicos y publicación ejecutable

La fuente HTTP es `services/api-inbox/openapi.fragment.json`; la fuente realtime es `services/api-inbox/asyncapi.yaml`. Los artefactos publicados son `orchestrator/docs/openapi/baseline/openapi.json` y `orchestrator/docs/asyncapi/inbox-realtime.yaml`.

Se elige una única vía de sincronización: `orchestrator/tools/contracts/sync-inbox-contracts.ts` importa directamente `docs/openapi/merge-logic.ts`; **no** invoca ni modifica `collect-openapi.ts`. Recibe obligatoriamente `--services-root <ruta>/services` y `--write` o `--check`, descubre todos los `api-*/openapi.fragment.json`, parsea OpenAPI 3.1, llama `mergeFragments`, rechaza colisiones y valida el documento resultante. También parsea AsyncAPI 3.0 desde `api-inbox/asyncapi.yaml`. En `--write`, serializa de forma determinista a archivos temporales adyacentes, hace `fsync` y `rename` atómico hacia baseline y AsyncAPI publicado. En `--check`, genera ambos artefactos en un directorio temporal, compara bytes normalizados y SHA-256 con los publicados y no escribe. Después exige todos los `operationId` Inbox. Su test usa una raíz temporal explícita y prueba un checkout sin sibling.

Se modifican `orchestrator/package.json`, `.github/workflows/quality.yml` y `.github/workflows/deploy-openapi-docs.yml`. Los scripts exactos son:

```json
{
  "contracts:sync": "tsx tools/contracts/sync-inbox-contracts.ts --services-root $IND_HUB_SERVICES_ROOT --write",
  "contracts:check": "tsx tools/contracts/sync-inbox-contracts.ts --services-root $IND_HUB_SERVICES_ROOT --check"
}
```

Ambos workflows hacen un segundo checkout con `actions/checkout` del repositorio privado `${{ github.repository_owner }}/ind-hub-api-gox-sls-pri-gh`, `path: ${{ runner.temp }}/ind-hub-api`, `ref` igual al SHA cerrado en `orchestrator/docs/openapi/baseline/inbox-contracts.manifest.json.servicesCommit` y `token: ${{ secrets.IND_HUB_API_READ_TOKEN }}`. `IND_HUB_API_READ_TOKEN` es una credencial GitHub App o fine-grained PAT propiedad del equipo Platform, con acceso exclusivo al repositorio `ind-hub-api-gox-sls-pri-gh` y permiso `contents:read`; se rota cada 90 días y nunca se imprime. Si falta, expira o no puede leer el commit, el workflow falla antes de instalar o publicar, con mensaje redactado que solo nombra el secret.

El manifest cerrado requiere `{schemaVersion:'1.0',servicesRepository:string,servicesCommit:string,openapiSha256:string,asyncapiSha256:string,generatedAt:string}`. `contracts:sync` recibe `--services-root`, obtiene `git -C <services-root>/.. rev-parse HEAD`, escribe ambos artefactos y el manifest mediante temporales+`fsync`+`rename`; `contracts:check` exige que el checkout esté exactamente en `servicesCommit`, recalcula ambos hashes y compara bytes. No se acepta branch móvil, checkout implícito ni SHA distinto. Los workflows definen `IND_HUB_SERVICES_ROOT=$RUNNER_TEMP/ind-hub-api/services`, ejecutan `npm run contracts:check` y solo después `OPENAPI_STANDALONE=true npm run quality` o `npm run docs:build`. El build standalone continúa consumiendo el baseline gobernado. La actualización deliberada hace checkout del commit elegido y ejecuta `contracts:sync`, de modo que artefactos y `servicesCommit` cambian en el mismo PR documental. Este gate, junto con `sync-inbox-contracts.test.ts`, es **C0** y precede al código productivo.

### Contrato normativo C0

Antes de escribir código productivo, C0 crea y valida `services/api-inbox/openapi.fragment.json` y `services/api-inbox/asyncapi.yaml`; esta sección fija su contenido y no deja decisiones de forma al implementador. Todo schema de objeto declara `additionalProperties:false`, `required` explícito y ejemplos válidos; toda unión usa `oneOf` con discriminador. Los strings se recortan antes de validar salvo firmas, cursores, IDs y contenido de mensajes, cuyos bytes o caracteres se conservan según se indica. OpenAPI declara `operationId` único, seguridad Bearer en toda operación salvo los dos webhooks, `X-Correlation-Id` UUID opcional de entrada y `traceId` UUID obligatorio en errores.

Schemas HTTP cerrados:

- `PageInfo`: requiere `page` entero `>=1`, `pageSize` constante `200`, `totalItems>=0`, `totalPages>=0`. `ConversationListResponse` requiere `data:ConversationSummary[]`, `pageInfo`, `nextCursor:string|null`, `unreadTotal>=0` y `watermark:ListWatermark`.
- `ConversationSummary` requiere `id`, `phone`, `alias`, `channel`, `status`, `reason`, `reasonLabel`, `unreadCount`, `lastMessagePreview`, `lastMessageAt`, `createdAt`, `updatedAt` y `generation`. Teléfono cumple `^[0-9]{8,15}$`; alias 0–100; previews 0–200; contadores son enteros no negativos; fechas son RFC3339 UTC o null.
- `Message` requiere `id` ULID, `msgSk`, `phone`, `type:customer|ai_agent|team`, `content:string|null` de máximo 4096, `createdAt`, `whatsappMessageId:string|null` máximo 256, `deliveryStatus:sent|delivered|read|failed|null`, `deliveryError:string|null` máximo 200 y `attachments:MessageAttachment[]` de 0–20 en orden estable. `MessageAttachment` representa historial entrante o saliente y requiere `fileName` 1–200, `mimeType` en `application/pdf|image/jpeg|image/png|image/gif|image/webp|audio/ogg|audio/webm`, `size` entero 1–16 MiB y `downloadUrl:string|null`; la URL solo aparece en respuestas y nunca en logs/eventos persistidos. `PreparedOutgoingAttachment` es un schema distinto para preparación/reserva saliente, usa el mismo allowlist y limita `size` a 1–7 MiB. Así se conserva `attachments[]` legacy y el historial/realtime puede representar audio entrante permitido por Meta sin ampliar el límite del composer.
- `ConversationDetail` es `oneOf` discriminado por `mode`. `full` requiere `conversation`, `messages` (0–50 ascendente), `hasMore`, `nextCursor`, `nonTerminalSends` y `watermark`; `before` requiere esos mismos campos, `conversation:null`, `nonTerminalSends:[]` y `requestedBefore`; `delta` requiere `conversation`, `messages` posteriores al cutoff, `nonTerminalSends`, `watermark` y `requestedSince`. `nextCursor` es string opaco o null. La conversación inexistente usa `full`, resumen con fallbacks documentados, arrays vacíos y no 404.
- `SendState` usa base cerrada `{clientMessageId,phone,createdAt,updatedAt,retryCount,preview,attachment}` más discriminador. `reserved` y `provider_pending` requieren solo base+state y prohíben result/error; `recovering` agrega `whatsappMessageId` 1–256 y prohíbe `msgSk`; `uncertain` agrega `resolutionRequired:true` y `reason` sanitizado 1–200; `failed_retryable` exige `retryCount:0`, `retryAvailable:true` y `error` 1–200; `committed` exige `result:{whatsappMessageId,msgSk,createdAt}` cerrado y `retryAvailable:false`; `failed` exige `error` y `retryAvailable:false`. `SendReplyRequest` requiere solo `content` 1–4096 y `clientMessageId` UUID. `SendAttachmentRequest` requiere solo `uploadId` UUID, `key` 1–1024, `caption` 0–4096 y `clientMessageId` UUID.
- `PrepareAttachmentsRequest` requiere `batchId` UUID y `files` de 1–20 `AttachmentPreparationItem`; cada ítem requiere `clientMessageId` UUID único en el lote, `fileName` 1–200, MIME permitido, `size` entero 1–7 MiB y `checksumSha256` Base64 canónico de exactamente 32 bytes. `PrepareAttachmentsResponse` requiere `batchId`, `expiresAt` y `uploads` en el mismo orden; cada upload requiere `clientMessageId`, `uploadId`, `key`, `uploadUrl`, `method:'PUT'` y `requiredHeaders`, objeto cerrado que exige `Content-Type`, `x-amz-checksum-sha256` y `x-amz-meta-upload-id`. No se firma `Content-Length`, porque Fetch puede gestionarlo; el backend compara el tamaño declarado mediante `HeadObject`.
- `RetrySendRequest` es el objeto vacío cerrado. `ResolveSendRequest` requiere `resolution:delivered|not_delivered`; exige `whatsappMessageId` de 1–256 solo para `delivered`, lo prohíbe para `not_delivered`, y permite `reason` 1–500. `UpdateContactRequest` requiere solo `name` 1–100. `MarkUnreadRequest` requiere exactamente `unread:true`.
- `BulkOperation` requiere `operationId` ULID, `kind:mark_all_read|recalculate_unread`, `state:materializing|applying|committed|failed`, `phase:materializing|applying|null`, `initiatorUserId`, `checkpoint:string|null`, `snapshotComplete:boolean`, `targetCount`, `processed`, `applied`, `unchanged`, `failed`, `createdAt`, `updatedAt`, `completedAt:null|string` y `failureCode:null|'BULK_WORKER_EXHAUSTED'|'BULK_SNAPSHOT_FAILED'|'BULK_APPLY_FAILED'`; contadores son enteros no negativos y su invariante es `processed=applied+unchanged+failed<=targetCount`. `StartBulkResponse` requiere `data:BulkOperation` y por tanto admite una operación nueva o global existente en `materializing|applying`; `ActiveBulkResponse` requiere `data:BulkOperation|null`. `initiatorUserId` se usa para auditoría, no para ownership: cualquier usuario con allowance `u` de INBOX puede consultar la operación activa global o su ID.
- Los cursores de lista e historial son strings base64url opacos de 1–2048; solo el backend conoce su objeto firmado. OpenAPI documenta `INBOX_CURSOR_EXPIRED` por expiración y `VALIDATION_CURSOR_INVALID` para firma, owner, scope, hash o formato inválidos.
- `ErrorResponse` requiere `code`, `message`, `details` y `traceId`. `details` es `null` o uno de objetos cerrados `ValidationDetails{field,reason}`, `ServiceWindowDetails{lastUserMessageAt}`, `SendStateDetails{sendState}`, `RetryDetails{retryAfterSeconds}` y `BulkConflictDetails{operationId}`. El frontend decide por `code` y nunca presenta `message` crudo.

Catálogo exacto de errores: `VALIDATION_INPUT_INVALID` (campo/body/rango), `VALIDATION_PHONE_INVALID`, `VALIDATION_CURSOR_INVALID`, `INBOX_CURSOR_EXPIRED`, `VALIDATION_IDEMPOTENCY_KEY_INVALID`, `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `INBOX_UPLOAD_NOT_FOUND`, `INBOX_UPLOAD_EXPIRED`, `INBOX_UPLOAD_ALREADY_USED`, `INBOX_UPLOAD_CONTENT_INVALID`, `INBOX_SERVICE_WINDOW_CLOSED`, `INBOX_IDEMPOTENCY_CONFLICT`, `INBOX_SEND_NOT_RETRYABLE`, `INBOX_SEND_RETRY_EXHAUSTED`, `INBOX_SEND_NOT_RESOLVABLE`, `INBOX_SNAPSHOT_LIMIT_REACHED`, `INBOX_BULK_CONFLICT`, `INBOX_PROVIDER_REJECTED`, `INBOX_CAPACITY_UNAVAILABLE` e `INTERNAL_ERROR`. Cada response de OpenAPI referencia exclusivamente estos códigos y C0 falla si un código usado no está en el enum.

AsyncAPI 3.0 define un server parametrizado `inbox-wss` con `protocol:wss`, `host:{apiId}.execute-api.us-east-1.amazonaws.com`, `pathname:/{stage}` y variables cerradas `apiId` y `stage`, donde `stage.enum=['dev','prd']`; el único channel address de suscripción es `/` relativo al server, no el literal ambiguo `/dev|prd`. El handshake declara en el binding WebSocket el query requerido `ticket` (string base64url, 43 caracteres) y prohíbe parámetros adicionales. El test de contrato sustituye `apiId` y `stage`, resuelve las URLs finales para dev/prd y exige igualdad byte a byte con `WebSocketUrl` exportada por CloudFormation para cada stage. Declara un `messageId` estable por mensaje: `inbox.new_message.v1`, `inbox.conversation_updated.v1`, `inbox.contact_updated.v1`, `inbox.conversation_deleted.v1`, `inbox.message_appended.v1`, `inbox.message_delivered.v1`, `inbox.agent_processing.v1`, `inbox.all_conversations_read.v1`, `inbox.bulk_operation_completed.v1` e `inbox.protocol_error.v1`. Los nueve primeros usan `RealtimeEnvelope` cerrado. `RealtimeMessage` replica `Message`; `attachments` es un array 0–20 de `RealtimeAttachment`, objeto cerrado que requiere `fileName`, el mismo enum MIME y `size` 1–16 MiB, pero nunca `downloadUrl`; el cliente obtiene URLs solo al reconciliar por HTTP. Payloads cerrados, respectivamente: `{message:RealtimeMessage,conversation:ConversationSummary}`, `{conversation:ConversationSummary}`, `{phone,alias,generation}`, `{phone,generation}`, `{message:RealtimeMessage,conversation:ConversationSummary}`, `{phone,whatsappMessageId,deliveryStatus,deliveryError}`, `{phone,processing}`, `{updated,operationId}`, y `{operation:BulkOperation}`. `protocol_error` no usa envelope secuenciado: requiere `{schemaVersion:'1.0',messageId:string,code:'INVALID_MESSAGE'|'UNSUPPORTED_MESSAGE'|'SUBSCRIPTION_MISMATCH',message:string,traceId:string}`; el servidor lo envía una vez y cierra con código 1008. Ningún payload contiene URL prefirmada, ticket, teléfono ajeno al stream detail ni secreto.

El gate C0 valida OpenAPI 3.1 y AsyncAPI 3.0, resuelve todos los `$ref`, exige `additionalProperties:false`, `required`, discriminadores, ejemplo válido, `operationId`, `messageId` y código de error declarado, y compara automáticamente métodos/paths de OpenAPI con `services/api-inbox/serverless.ts` y `functions/routes.go`; cualquier diferencia falla CI.

### DTO y operaciones HTTP

Éxito de colección: `data` y `pageInfo` al mismo nivel. Éxito de recurso: `{data:<objeto>}`. Error: `{code,message,details,traceId}`. Fechas RFC3339 UTC; teléfono `^[0-9]{8,15}$`; JSON con `additionalProperties:false`; body máximo 32 KiB, excepto webhook 1 MiB.

Tipos normativos principales:

```ts
interface PageInfo { page:number; pageSize:200; totalItems:number; totalPages:number; }
type ListWatermark = {stream:'list';sequence:number};
type DetailWatermark = {stream:`detail:${string}`;sequence:number};
type ConversationStatus = 'bot'|'derived';
type MessageType = 'customer'|'ai_agent'|'team';
type DeliveryStatus = 'sent'|'delivered'|'read'|'failed';
interface ConversationSummary {
  id:string; phone:string; alias:string; channel:'whatsapp'; status:ConversationStatus;
  reason:'sin_presupuesto'|'sin_respuesta'|'error_gemini'|null; reasonLabel:string|null;
  unreadCount:number; lastMessagePreview:string|null; lastMessageAt:string|null;
  createdAt:string|null; updatedAt:string|null; generation:number;
}
interface SendStateBase {
  clientMessageId:string; phone:string; createdAt:string; updatedAt:string; retryCount:0|1;
  preview:string|null; attachment:{fileName:string;mimeType:string;size:number}|null;
}
type SendStateName = 'reserved'|'provider_pending'|'recovering'|'uncertain'|'failed_retryable'|'committed'|'failed';
type NonTerminalSend = Extract<SendState,{state:'reserved'|'provider_pending'|'recovering'|'uncertain'|'failed_retryable'}>;
```

OpenAPI expresa `SendState` como `oneOf` discriminado por `state`: `reserved|provider_pending` no tienen result/error; `recovering` posee WAMID sin `msgSk`; `uncertain` usa `resolutionRequired=true`; `failed_retryable` usa `retryCount=0` y `retryAvailable=true`; `committed` posee WAMID, msgSk y fecha; `failed` posee error y no retry. Preview, fallos y causas se sanitizan a 200 caracteres.

| Operación | Validación y éxito | Fallos concretos |
|---|---|---|
| `GET /conversaciones` | `page>=1`, `pageSize=200`, cursor desde página 2, `q` trim 1–100, orden fijo; 200 con data, pageInfo, nextCursor, unreadTotal y watermark | 400 cursor/input; 429 cuota snapshot; 503 capacidad, sin parcial |
| `GET /conversaciones/{telefono}` | teléfono válido; `since` RFC3339 o cursor, excluyentes; pageSize 1–50; 200 full/before/delta con conversación, mensajes, nonTerminalSends y watermark | 400 input/cursor; inexistente devuelve detalle vacío normativo 200 |
| `POST /conversaciones/{telefono}/respuestas` | content trim 1–4096 y UUID clientMessageId; 200 committed o 202 no terminal | 409 idempotencia; 422 ventana; 502 rechazo Meta con sendState |
| `POST /conversaciones/{telefono}/adjuntos:preparar` | batch UUID, 1–20 archivos, IDs únicos, nombre 1–200, 1 byte–7 MiB y SHA-256 | 400; 409; 429 límite; atomicidad total |
| `POST /conversaciones/{telefono}/adjuntos` | key, caption trim 0–4096, clientMessageId; 200/202 SendState | 404 reserva; 409 vencida/usada; 422 contenido/ventana; 502 Meta |
| `GET /envios-inbox/{clientMessageId}` | UUID y owner implícito; 200 SendState | 404 también para owner distinto |
| `POST /envios-inbox/{clientMessageId}:reintentar` | allowance `c`, solo failed_retryable y retryCount=0; 200/202 | 403; 404; 409 no reintentable/agotado; 502 Meta |
| `PATCH /envios-inbox/{clientMessageId}/resolucion` | allowance `u`; resolución confirmada, WAMID 1–256 cuando aplica, motivo 1–500 | 400; 403; 404; 409 no resoluble |
| `PATCH /conversaciones/{telefono}/contacto` | name trim 1–100; 200 phone/name | 400; 500 sin evento |
| `PATCH /conversaciones/{telefono}/estado-lectura` | body exacto `{unread:true}`; 200 unreadCount=1 | 400; 500 |
| `DELETE /conversaciones/{telefono}` | sin body; 200 idempotente | 400; 500 antes del commit lógico |
| `PATCH /conversaciones:marcar-leidas` | Idempotency-Key UUID; allowance `u`; 202 `{data:BulkOperation}` nueva o mutex global existente en `materializing|applying` | 400; 409 solo si la misma idempotency key tiene hash distinto |
| `PATCH /conversaciones:recalcular-no-leidas` | misma regla y mutex global independiente por kind; 202 | igual |
| `GET /operaciones-inbox/{operationId}` | ULID y allowance `u`; 200 BulkOperation sin restricción por iniciador | 400; 404 |
| `GET /operaciones-inbox` | kind válido, `state=active`, allowance `u`; consulta mutex global; 200 operación o null | 400; 403 |
| `GET /conversaciones:suscripcion` | scope list/detail; phone solo detail; 200 URL/ticket no-store | 400; 401; 403; 429 |
| `GET /webhooks/whatsapp` | parámetros Meta 1–4096; 200 challenge | 400; 403; 503 config |
| `POST /webhooks/whatsapp` | JSON <=1 MiB y firma obligatoria; 200 accepted/ignored | firma/payload inválido: 200 ignored; tamaño: 413; dependencia: 503 para retry |

La asignación normativa de códigos por operación es: toda validación de body/query usa `VALIDATION_INPUT_INVALID`, teléfono `VALIDATION_PHONE_INVALID`, cursor según catálogo y auth `AUTH_*`; lista usa `INBOX_SNAPSHOT_LIMIT_REACHED`/`INBOX_CAPACITY_UNAVAILABLE`; responder/adjuntar usan `INBOX_IDEMPOTENCY_CONFLICT`, `INBOX_SERVICE_WINDOW_CLOSED` e `INBOX_PROVIDER_REJECTED`; preparación/confirmación de adjuntos usan `INBOX_UPLOAD_NOT_FOUND|EXPIRED|ALREADY_USED|CONTENT_INVALID`; retry usa `INBOX_SEND_NOT_RETRYABLE|INBOX_SEND_RETRY_EXHAUSTED`; resolución usa `INBOX_SEND_NOT_RESOLVABLE`; recursos ocultos/owner distinto usan `RESOURCE_NOT_FOUND`; bulk usa `INBOX_BULK_CONFLICT`. Un fallo interno no clasificado usa únicamente `INTERNAL_ERROR`. El OpenAPI enumera el subconjunto exacto en cada status; no admite códigos libres.

En `POST /webhooks/whatsapp`, `accepted` e `ignored` son bodies 200 distintos del envelope de error. El 413 usa `VALIDATION_INPUT_INVALID`; el 503 por SSM usa `INBOX_CAPACITY_UNAVAILABLE`. El detalle de firma nunca se devuelve al proveedor.

En cada GET full, delta o before de detalle se lee con consistencia fuerte `SEQ#DETAIL#<phone>/META` **antes de leer cualquier conversación, mensaje o SEND_VIEW**. La respuesta devuelve exactamente ese `startSequence`; nunca relee la secuencia al final. Un cambio posterior tiene secuencia mayor y será aplicado desde el buffer; si ya apareció en una lectura posterior al cutoff, el dedupe por IDs hace idempotente el evento.

## Backend `services/api-inbox`

Se crea `services/api-inbox` con `cmd/local-api`, un `cmd/fn-*-v1/main.go` por endpoint/worker, `cmd/migrate-inbox`, `functions`, `domain`, contratos, `serverless.ts`, `service.config.json`, `go.mod` y tests. Se modifican `common/api-services.ts`, `go.work` y `libs/lambdautil/identity.go`. No se crean `repository/` ni `store/`; clientes inyectables y datasources viven bajo `domain/<subdominio>/datasources`.

Packages HTTP: `listconversations`, `getconversation`, `sendreply`, `prepareattachment`, `sendattachment`, `getsend`, `retrysend`, `resolvesend`, `updatecontact`, `markunread`, `deleteconversation`, `startmarkallread`, `startrecalculateunread`, `getbulkoperation`, `listbulkoperations`, `createsubscription`, `verifywebhook` y `processwebhook`. WebSocket: `wsconnect`, `wsdisconnect`, `wsdefault`. Workers: `outboxworker`, `bulkworker`, `recoveryworker`, `cleanupworker` y `dlqworker`. Cada package expone `Register` y `Handle`; `functions/routes.go` registra exactamente OpenAPI.

## Persistencia, secuencias y snapshots

`ConversacionesTable` usa PK/SK, TTL único `expiresAt` en epoch seconds y stream `NEW_AND_OLD_IMAGES`. Queda prohibido `Scan`. La capa de dominio es dueña de generation, secuencia, índices versionados, journals, TTL y outbox; datasources no exponen writes parciales.

### Índices versionados inmutables

La lista y búsqueda no consultan índices mutables. Cada cambio visible obtiene el próximo `listSequence` mediante lectura consistente y una `TransactWrite` optimista que condiciona el valor anterior, actualiza `SEQ#LIST`, escribe datos y una nueva versión de LIST y SEARCH. Si otro escritor gana, se relee y reintenta con jitter. La versión de negocio nunca se modifica; al superarla se actualiza su `expiresAt` a `max(expiresAt, now+31m)`, cubriendo cualquier snapshot renovable de 30 minutos más 60 segundos, y la nueva queda vigente hasta el TTL de 90 días de la conversación.

- LIST: `PK=LIST_VERSION#<shard 00..0F>`, `SK=PHONE#<phone>#SEQ#<sequence padded 20>`. Incluye `validFromSequence`, operación `upsert|delete`, generation y un `ConversationSummary` congelado.
- SEARCH: `PK=SEARCH_VERSION#<shard 00..0F>`, misma forma de SK. Incluye además alias/teléfono normalizados y el mismo resumen congelado.
- El shard es el nibble bajo de SHA-256(phone). La normalización NFD elimina diacríticos, minúsculas y colapsa espacios; teléfono conserva dígitos.
- Alias, unread, actividad, status, delivery, delete y recreación escriben versiones en la misma transacción que META, secuencia y OUTBOX. Delete escribe tombstone; nunca borra una versión elegible.

Página 1 lee primero `cutoffSequence` de `SEQ#LIST`, luego consulta con `ConsistentRead=true` las 16 particiones, concurrencia máxima 4. Agrupa por teléfono, ignora versiones `>cutoffSequence`, elige la mayor `validFromSequence<=cutoffSequence`, descarta tombstones y filtra búsqueda sobre esa versión. Ordena por actividad, calcula totales y persiste en `LIST_RESULT` **el resumen completo congelado**, no `{phone,generation}` ni referencias a CONV. Por ello cambios o expiraciones posteriores no alteran páginas, totales ni unread.

`LIST_RESULT#session/META` guarda owner, query/sort hash, cutoff, totales, slot, `createdAt`, `lastAccessAt` y `absoluteExpiresAt`; `CHUNK#n` guarda hasta 100 resúmenes congelados. La vigencia inicial es 15 minutos y cada página renueva `expiresAt=now+15m` para META, chunks y slot sin superar `absoluteExpiresAt=createdAt+30m`; las versiones LIST/SEARCH superadas se conservan al menos hasta ese máximo absoluto más 60 s. Tres `LIST_SLOT#user/SLOT#0..2` limitan sesiones. Página 1 intenta los slots 0, 1 y 2 en orden mediante hasta tres `TransactWriteItems` separados: cada intento reclama un único slot con condición `attribute_not_exists(sessionId) OR expiresAt<now` y crea META de sesión en la misma transacción; El primer éxito detiene los intentos. Cuatro page-1 concurrentes producen tres sesiones y una respuesta 429, nunca doble ownership. Cursor firmado: versión, sessionId, página, hash, owner hash, slot, issuedAt y absoluteExpiresAt. Cada página valida firma, owner, hash, session, slot y límites antes de Query; expiración válida devuelve 400 `INBOX_CURSOR_EXPIRED`, mientras alteración/mismatch devuelve `VALIDATION_CURSOR_INVALID`. Al finalizar libera slot condicionalmente por sessionId; TTL cubre abandono.

Si el frontend recibe `INBOX_CURSOR_EXPIRED`, inicia page 1 con el mismo `q` y orden, conserva las filas visibles, reconcilia por teléfono reemplazando datos existentes y anexando solo IDs nuevos, y continúa desde el cursor nuevo; no vacía la lista ni cambia selección. Solo muestra toast de continuidad perdida si la nueva page 1 también falla o la conversación seleccionada ya no puede recuperarse. Una pausa mayor a dos minutos, pero menor a 15, continúa el snapshot original sin recuperación.

`CONV_COUNT/META.activeCount` se actualiza en la misma TransactWrite que crea por primera vez, elimina o recrea `CONV/META`; duplicados y actualizaciones no lo alteran. El preflight fija `maxMaterializableConversations` en SSM a un valor **probado**, nunca menor a `max(20.000,ceil(activeCount×1,25))`, y bloquea cutover si no existe 25 % de holgura. CloudWatch alarma al 80 %, 90 % y 100 %. El prototipo y load test usan el máximo configurado, incluyen versiones recientes y deben cumplir 24 s y <70 % de memoria Lambda, con p95 <10 s y p99 <20 s.

El umbral es operativo, no una condición de escritura: el webhook de la conversación N+1 siempre persiste META, MSG, índices, contador y OUTBOX en una única transacción, responde 200 tras commit y puede derivar a humano; nunca descarta ni archiva automáticamente datos. Mientras `activeCount>maxMaterializableConversations`, página 1 y nuevos bulk devuelven 503 `INBOX_CAPACITY_UNAVAILABLE` con `RetryDetails.retryAfterSeconds=60`, métrica crítica y alarma, sin resultado parcial. El runbook aumenta shards/límite solo después de un load test aprobado y actualiza SSM; hasta entonces los operadores acceden por teléfono directo y los eventos se conservan. No hay fallback a `Scan`, GSI mutable ni borrado por antigüedad sin una regla de negocio aprobada. Esta degradación segura es la excepción explícita frente a pérdida de mensajes; el gate de holgura evita que sea operación normal.

### Modelo principal

| PK / SK | Uso |
|---|---|
| `CONV#phone / META`, `MSG#ulid` | conversación y mensajes con generation |
| `LIST_VERSION#shard / PHONE#...#SEQ#...` | versiones de lista |
| `SEARCH_VERSION#shard / PHONE#...#SEQ#...` | versiones de búsqueda |
| `LIST_RESULT#session / META|CHUNK#n`, `LIST_SLOT#user/SLOT#n` | snapshot y cuota |
| `META_MSG#id/META`, `WAMID#id/META` | dedupe y delivery |
| `SEND#clientMessageId/META` | máquina de envío |
| `SEND_VIEW#owner#phone / <createdAt>#<clientMessageId>` | proyección autoritativa no terminal, consultable consistentemente |
| `UPLOAD_BATCH#owner#batch/META`, `UPLOAD#clientMessageId/META` | reservas |
| `OUTBOX_DONE#<aggregate>/EVENT#<eventId>` | histórico terminal de realtime/workflows; pendientes viven en WORK_DUE |
| `WORK_DUE#OUTBOX#<shard> / <nextAttemptAt>#<eventId>` | OUTBOX pending/leased consultable sin Scan; incluye stream/aggregate y sequence |
| `WORK_DUE#SEND#<shard> / <nextAttemptAt>#<clientMessageId>` | proyección base para SEND recuperables/vencidos sin Scan |
| `OUTBOX_DISPATCH#<stream>/META`, `OUTBOX_GAP#<stream>/SEQ#<sequence>` | cursor y llegadas realtime adelantadas persistidas/ordenadas |
| `CONV_COUNT/META` | contador exacto de conversaciones activas y umbral materializable |
| `SEQ#LIST/META`, `SEQ#DETAIL#phone/META`, `SEQ#ROLLBACK/META` | secuencias persistentes |
| `BULK`, `BULK_REQUEST`, `BULK_ACTIVE`, `BULK_TARGET`, `BULK_APPLIED` | operación masiva; ACTIVE es global por aplicación+kind |
| `ROLLBACK_BUCKET#hour#shard / SEQ#...` | journal base fuertemente consistente |
| `TOMBSTONE#phone/GEN#n` | delete versionado |

Toda transición SEND mantiene SEND_VIEW y su proyección `WORK_DUE#SEND` en la misma transacción: `reserved`, `provider_pending` y `recovering` escriben/reprograman una entrada con `nextAttemptAt`, shard bajo de SHA-256(clientMessageId), estado esperado y lease; `uncertain` se conserva sin retry automático y solo agenda alarma; `committed/failed` eliminan SEND_VIEW y la due-entry. El detalle consulta SEND_VIEW con Query consistente, vuelve a validar owner/phone/generation y no depende de un GSI eventual para reconciliación.

Todo OUTBOX `pending|leased` es físicamente consultable en una due-queue base `WORK_DUE#OUTBOX#00..0F/<nextAttemptAt>#<eventId>` y contiene su identidad lógica (`outboxType`, stream/aggregate, sequence, eventId, dedupe key y payload). Al publicar/terminalizar se mueve a su clave histórica `OUTBOX_DONE#<aggregate>/EVENT#<eventId>` con TTL 14 días; al fallar se reemplaza bajo el nuevo `nextAttemptAt`, todo mediante TransactWrite condicionada por estado/lease. `cleanupworker` y `recoveryworker` recorren los 16 shards mediante `Query PK=:shard AND SK<=:now`, límite 100 por shard y concurrencia 4; adquieren lease con condición sobre estado, `leaseOwner` y `leaseUntil`. SEND sí usa una proyección `WORK_DUE#SEND`, creada/reprogramada/eliminada en la misma transacción que SEND. Un lease vencido es recuperable por otro worker. El shard deriva de SHA-256 del ID, nunca se usa TTL como scheduler y queda prohibido descubrir trabajo con `Scan` o GSI eventual.

### TTL normativo

| Ítem | Retención |
|---|---|
| MSG, WAMID | creación +90 días, sin renovación |
| CONV/META y versión LIST/SEARCH vigente | now +90 días en cambio funcional |
| versión LIST/SEARCH superada | `max(expiresAt,now+31m)`, para cubrir snapshot máximo de 30 min +60 s; cleanup condicionado |
| META_MSG | creación +7 días |
| META/CHUNK de LIST_RESULT y LIST_SLOT | 15 min renovables por página, máximo absoluto 30 min desde creación |
| TICKET | creación +60 s |
| UPLOAD reservado/fallido | creación +24 h; vigencia funcional 300 s |
| UPLOAD consumed | terminalizedAt +7 días |
| UPLOAD_BATCH reserved/failed | createdAt +24 h |
| UPLOAD_BATCH consumed/terminal | terminalizedAt +7 días |
| objeto S3 temporal | lifecycle 1 día |
| conexión/lookup | +24 h; 410/disconnect elimina antes |
| RATE | evento +60 s |
| SEND y SEND_VIEW no terminal | sin TTL; due-queue SEND agenda recuperación >60 s, alarma 15 min y escalamiento 24 h |
| SEND terminal | now +90 días; SEND_VIEW y due-entry eliminados |
| OUTBOX pending/leased | sin TTL; due-queue OUTBOX agenda retry; terminal +14 días y due-entry eliminada |
| WORK_DUE OUTBOX/SEND | sin TTL mientras vigente; se elimina/reprograma atómicamente con el agregado; cleanup verifica huérfanos por ID conocido |
| BULK/BULK_ACTIVE no terminal | sin TTL; BULK terminal +14 días y ACTIVE eliminado |
| BULK_REQUEST/TARGET/APPLIED | terminalización +14 días |
| SEQ#*, OUTBOX_DISPATCH y OUTBOX_GAP | **sin TTL**; GAP se elimina solo al drenar la secuencia |
| ROLLBACK | `max(changedAt+90d, rollbackSupportedUntil+7d)` |
| tombstone | now +90 días |

La ventana soportada de rollback es exactamente 14 días desde `cutoverAt`: `rollbackSupportedUntil=cutoverAt+14d`; el margen de seguridad es 7 días. El registro de cutover guarda ambos instantes. Reloj inyectado prueba todos los bordes y que TTL eventual no habilita tickets o reservas vencidas.

## Operaciones masivas durables

El PATCH inicial usa mutex **global por aplicación y kind**. Primero lee consistentemente `BULK_ACTIVE#APP#INDOMITO_HUB/KIND#<kind>`: si apunta a una operación `materializing|applying`, devuelve 202 `{data:<BulkOperation activa>}` a cualquier caller con allowance `u`, sin importar el iniciador y sin crear otro request. Si no existe, hace una única `TransactWrite` con cuatro ítems: `BULK#operationId/META` (incluye `initiatorUserId`), `BULK_REQUEST#initiatorUserId#idempotencyKey/META`, `BULK_ACTIVE#APP#INDOMITO_HUB/KIND#kind` condicionado a ausencia o referencia terminal, y el propio OUTBOX due `WORK_DUE#OUTBOX#<shard>/<nextAttemptAt>#<eventId>` con aggregate `BULK#operationId` y dedupe `bulk:<operationId>:materializing:start`. `BULK` nace `state=materializing`, `phase=materializing`, `checkpoint=null`, `snapshotComplete=false`, `leaseOwner=null` y `leaseUntil=null`; solo después responde 202. Carreras de distintos usuarios convergen por la condición de ACTIVE: el perdedor relee el mutex y devuelve la misma operación activa.

DynamoDB Stream publica cada OUTBOX en SQS FIFO con `MessageGroupId=bulk:<operationId>` y `MessageDeduplicationId` igual a su dedupe key. El router marca OUTBOX `published` y elimina su due-entry mediante transacción condicional **solo después** de confirmar `SendMessage`; un crash anterior deja OUTBOX+due pending y la redelivery o `cleanupworker` lo republica idempotentemente. Los retries/DLQ de SQS recuperan fallos de un chunk, pero nunca son el bucle normal de avance.

Cada invocación adquiere lease condicional sobre `BULK` (`leaseUntil<now OR leaseOwner=self`), procesa como máximo **98 targets** o 10 s y termina un checkpoint completo. En `materializing`, usa el algoritmo LIST versionado y cutoff y calcula para cada target una key determinista `BULK_TARGET#operationId/PHONE#phone` y su hash encadenado canónico. La continuación se persiste físicamente como el propio ítem OUTBOX bajo `PK=WORK_DUE#OUTBOX#<shard>`, `SK=<nextAttemptAt>#<eventId>`; contiene `outboxType:'workflow'`, aggregate, operationId, phase, dedupe key y estado. Por ello no necesita una segunda proyección y puede obtenerse tanto por due-queue como por sus atributos deterministas.

Un chunk se confirma en una sola `TransactWriteItems` de máximo 100 acciones y menos de 4 MiB: hasta 98 `Put BULK_TARGET` con key determinista, 1 `Update BULK` condicionado por lease/checkpoint que persiste cursor, contador y hash, y 1 `Put OUTBOX` de continuación en la due-queue. En reanudación, si la transacción quedó con resultado desconocido, el worker relee BULK y targets: checkpoint/hash ya avanzados significan éxito; si no avanzaron, repite la misma transacción; un target existente con hash distinto marca `BULK_SNAPSHOT_FAILED`. El tamaño se estima antes de DynamoDB y, si excede 4 MiB, se reduce el número de targets sin avanzar el checkpoint. En el último chunk, la misma forma de hasta 98 targets + Update BULK + OUTBOX fija `snapshotComplete=true`, `targetCount`, hash final, `phase=applying`, `state=applying` y checkpoint inicial, y crea `bulk:<operationId>:applying:start`. Nunca aplica targets antes de `snapshotComplete`. Tests cubren 98 y 99 candidatos, reducción por 4 MiB y crash antes/después de la única transacción, del trigger y de `SendMessage`.

En `applying`, cada target usa una de dos transacciones mutuamente excluyentes:

1. **Applied:** `Put BULK_APPLIED` con `attribute_not_exists(PK)`, `Update CONV` condicionado a generation esperada, cambios de índices/journal/outbox y ADD de contadores.
2. **Unchanged:** solo se intenta cuando cancellation reasons identifican mismatch generation/ausencia. Se relee CONV consistentemente y ejecuta `Put BULK_APPLIED` condicional, `ConditionCheck attribute_not_exists(CONV.pk) OR generation<>expected` e incremento de `processed/unchanged`, sin mutar conversación.

Si falla el Put porque el ledger ya existe, se lee consistentemente y se trata como éxito previo. Un error distinto de mismatch es recuperable y no entra en unchanged. Tras verificar ledger de todo el chunk, una TransactWrite avanza checkpoint, renueva/libera lease y crea la continuación directamente en `WORK_DUE#OUTBOX`. Crash antes del commit repite el chunk; crash después del commit pero antes/durante publicación se recupera desde la due-queue sin duplicar efectos. En el último chunk no crea continuación: fija `committed`, limpia phase/checkpoint/lease, elimina el ACTIVE global con condición `operationId=:id` y crea `bulk_operation_completed`. DLQ tras cinco fallos **del mismo mensaje** fija `failed`, conserva checkpoint, libera ACTIVE y alarma; reanudación administrativa crea una nueva continuación desde el checkpoint persistido sin cambiar operationId.

Los campos persistidos obligatorios son `state`, `phase`, `checkpoint`, `snapshotComplete`, `leaseOwner`, `leaseUntil`, `targetCount`, `processed`, `applied`, `unchanged`, `failed`, hash y timestamps. Se prueba 20.000 targets y crash en cuatro fronteras de cada fase: antes/después de la TransactWrite de checkpoint y antes/después de `SendMessage`; debe terminar una vez, sin depender de más de una recepción exitosa por chunk y sin targets omitidos/duplicados.

## Realtime y AsyncAPI

Envelope:

```ts
type RealtimeStream = 'list' | `detail:${string}`;
interface RealtimeEnvelope<T> {
  schemaVersion:'1.0'; eventId:string; type:RealtimeType; occurredAt:string;
  stream:RealtimeStream; phone:string|null; sequence:number; payload:T;
}
```

List y cada detail poseen secuencia independiente. Una mutación que notifica ambos incrementa ambos contadores optimistamente dentro de la misma TransactWrite y crea un OUTBOX due por stream. Para realtime, `MessageGroupId` es **exactamente `stream`**, nunca aggregateId. El router agrupa todos los records recibidos por `stream`, los ordena por `sequence` antes de publicar y lee consistentemente `OUTBOX_DISPATCH#stream/META.nextSequence`. Si el batch trae N+1 antes que N, procesa N primero y luego drena el sufijo contiguo. Una secuencia adelantada sin su predecesora se persiste idempotentemente como `OUTBOX_GAP#stream/SEQ#n` (con payload/hash y sin TTL), se confirma como procesada para el event source mapping y no bloquea el batch; cada avance consulta por Query desde `nextSequence` y drena gaps contiguos. Tras confirmar SQS, una TransactWrite avanza DISPATCH, mueve OUTBOX a DONE y elimina el GAP si existía. Solo conflictos de condición se reintentan; un payload/hash distinto para la misma secuencia es fatal, alarma y va a DLQ. Workflows no realtime usan grupos separados (`bulk:<id>`, `agent:<phone>`, etc.). DynamoDB Streams solo garantiza su ventana administrada de retención; SQS retiene cuatro días, y la due-queue sin TTL es la fuente durable para republicación después de perder el trigger.

Eventos: `new_message`, `conversation_updated`, `contact_updated`, `conversation_deleted`, `message_appended`, `message_delivered`, `agent_processing`, `all_conversations_read` y `bulk_operation_completed`, con los payloads tipados del contrato. `$default` emite `protocol_error` no secuenciado y cierra.

`GET /conversaciones:suscripcion` genera 32 bytes CSPRNG, persiste solo SHA-256 con owner/scope/phone y expiry 60 s. `$connect` consume una vez y crea conexión/lookup en una TransactWrite. No hay fallback a JWT ni ticket reutilizable. Se mantienen conexiones list/detail.

El store pausa un stream ante salto, bufferiza hasta 200 eventos, hace reconciliación HTTP, fija lastSequence al watermark capturado al inicio del GET, descarta `<=watermark` y aplica sufijo contiguo. Tres fallos, hueco persistente o buffer lleno cierran socket y mantienen HTTP. Reconecta a 1/2/4/8/16/30 s con jitter ±20 %, ticket nuevo y reconciliación previa.

## Frontend `app-ngx-hub`

Se crea `src/app/indomito-hub/inbox/` con `constants`, `components`, `interfaces`, `pages`, `services`, `stores`, `types`, `fn` e `inbox.routes.ts`. Shell/detail son containers; componentes usan `input()`/`output()` y no hacen IO. Store, servicio HTTP y realtime se proveen en ruta. Se modifican `app.routes.ts`, auth/error handling, environments, tokens compartidos, package/lockfile, Playwright y `e2e/inbox`.

Ruta lazy `comunicaciones/conversaciones`, `data.module='INBOX'`, `moduleGuard`; detalle `:phone`. Teléfono inválido muestra error y vuelve. Al salir se destruyen sockets, timers, recorder y tracks.

Se modifica `src/app/core/auth/auth.service.ts` para agregar `canPerform(moduleCode: string, allowance: 'c'|'r'|'u'|'d'): boolean`: busca directamente en `permissions()` el permiso del módulo activo, exige la letra solicitada y, para LV2, exige además que el padre `COM` esté activo y tenga `r`. `canAccess` delega en `canPerform(code,'r')`. Se crea `src/app/shared/directives/has-permission.directive.ts`, directiva estructural standalone `*appHasPermission="{module:'INBOX',allowance:'c'}"`, que usa un `computed` sobre `AuthService.permissions()` y no renderiza el control no autorizado; para grupos complejos el container expone computed equivalentes. No se usa solo `disabled`, porque una acción sin permiso no debe anunciarse ni ser focalizable. El backend y authorizer continúan siendo autoridad y devuelven 403 aunque el cliente sea manipulado.

Matriz obligatoria: abrir módulo, lista, detalle, búsqueda, ticket y estado de envío=`r`; responder, adjuntar, grabar audio y reintentar=`c`; editar alias, marcar no leído, marcar todas leídas, recalcular y resolver uncertain=`u`; eliminar conversación=`d`. Menú/popover no renderiza entradas sin allowance y no se abre si queda vacío. Sin `COM:r`, ningún control ni ruta INBOX se habilita aunque exista permiso hijo. `auth.service.spec.ts`, `has-permission.directive.spec.ts` y specs de containers cubren cada letra aislada, combinaciones CRUD, módulo inactivo y parent COM sin lectura.

### UIX exacta y accesibilidad

Escritorio: panel izquierdo 22,5 rem y detalle flexible. Móvil 320/390: solo lista o detalle. Se conservan textos, skeletons, contadores, tag Humano, badge 99+, menú, diálogos, burbujas, checks, agente y aviso de ventana. Fila de 76 px; `li` con botones hermanos evita nesting inválido sin variar geometría; aria-current, foco restaurado y target 44×44 son excepción accesible.

PrimeNG provee controles y Tailwind composición. Bordes `border-line/75 dark:border-line/55`; amarillo siempre `text-night`. Tokens reproducen WhatsApp en claro/oscuro. Contraste se valida como par; fallo legacy se corrige mínimamente y se registra.

### Lista, historial y scroll

Lista: cache dos minutos, debounce 300 ms, filtro unread local, LRU cinco detalles, primera carga backend 200. Cada cruce a 160 px del final revela exactamente 20 desde buffer; repone otra página 200 cuando quedan menos de 20. CDK virtual, fila 76 px, dedupe por teléfono y orden por actividad.

Historial fija constantes:

```ts
const VIRTUAL_SCROLL_THRESHOLD = 80;
const MESSAGE_ROW_HEIGHT_PX = 96;
const LOAD_OLDER_THRESHOLD_PX = 160;
const NEAR_BOTTOM_THRESHOLD_PX = 80;
```

Con 0–80 filas usa scroll nativo pegado abajo; con 81 o más usa CDK virtual con itemSize 96 px. A menos de 160 px del inicio carga 50 anteriores. Antes del prepend registra la key del primer mensaje visible y su offset; tras render restaura esa key/offset. Al cruzar 80→81 convierte posición nativa a índice+offset y al volver a 80 realiza la conversión inversa, sin salto perceptible. Mensaje nuevo autoscroll si distancia al fondo <80; si no, muestra `N nuevo(s)`. Tests obligatorios: 79/80/81 filas y prepend de 50 tanto en modo nativo como virtual.

### Composer y recuperación SendState

FormControl string no nullable; trim para texto; ventana 24 h validada también en backend. Se conservan exactamente los 40 emojis legacy y caret/foco. Selector manual acepta `.pdf,image/*`; PDF, JPEG, PNG, GIF y WebP, 1 byte–7 MiB, basename 1–200. Recorder prefiere OGG Opus, luego WebM Opus y WebM. Lote 1–20 atómico; PUT y confirmación concurrentes sin límite artificial; caption solo primer ordinal.

Burbuja optimista usa UUID clientMessageId. El seguimiento usa intervalos 1, 2, 4, 8, 15 y 15 s, y después repite cada 15 s hasta 15 minutos desde `createdAt`. Al cumplirse 15 minutos detiene polling para evitar actividad infinita, conserva la burbuja y solo refresca por evento, `visibilitychange`, reconnect, cambio/reapertura de conversación o recarga manual. Nunca reenvía automáticamente.

| Estado al abrir/recargar/reconectar | UI y seguimiento | Transición/acción |
|---|---|---|
| `reserved` | burbuja “Preparando envío”, pending; polling completo | recovery reclama >60 s; si certifica cero bytes enviados pasa a failed_retryable, si transmisión posible a uncertain |
| `provider_pending` | “Enviando…”, pending; polling completo | Meta/WAMID lleva a recovering/committed; fallo clasificado a failed/failed_retryable/uncertain |
| `recovering` | “Confirmando entrega…”, WAMID visible internamente; polling completo | worker persiste MSG/WAMID y pasa committed, sin reenviar |
| `uncertain` | “Entrega por confirmar”, visible, sin CTA ni retry automático; polling hasta 15 min y luego refrescos pasivos | solo webhook o resolución administrativa allowance `u` terminaliza |
| `failed_retryable` | burbuja fallida visible con causa sanitizada; sin polling continuo | CTA **Reintentar** solo con allowance `c`; llamada única consume retryCount=1 atómicamente antes de Meta |

El detalle devuelve los cinco estados en `nonTerminalSends`; cambiar de conversación no los elimina y la vuelta los reconstruye. Si una llamada original repite mismo ID/hash, devuelve estado persistido; hash distinto 409.

### Recuperación de operaciones masivas

Al inicializar Inbox y después de cada reconexión WebSocket, el store llama en paralelo `GET /operaciones-inbox?kind=mark_all_read&state=active` y `GET /operaciones-inbox?kind=recalculate_unread&state=active`. Ambas consultas requieren `u` y restauran el mutex global de cada kind aunque otro administrador lo haya iniciado. Muestra `processed/targetCount` (indeterminado durante materialización), mantiene ocupado únicamente el CTA del mismo `kind` y no habilita una segunda solicitud; carreras entre pestañas o usuarios distintos reciben la misma `BulkOperation` en `materializing|applying` y convergen al mismo ID.

Por cada operación activa el store consulta `GET /operaciones-inbox/{operationId}` con backoff 1/2/4/8/15 s y luego cada 15 s hasta estado terminal; `visibilitychange`, reconnect y `bulk_operation_completed` disparan consulta inmediata, deduplicada por operationId. WebSocket y polling alimentan una sola reducción idempotente por `updatedAt` y estado. En `committed`, detiene timers, consulta page 1 por HTTP, reconcilia lista/unread sin borrar selección y muestra resumen. En `failed`, detiene timers, libera CTA y muestra un texto local elegido por `failureCode`, nunca la causa cruda. Un 404 del polling tras haber observado la operación se reintenta tres veces y luego reconcilia operaciones activas; 401 pausa hasta reautenticación; error de red mantiene estado ocupado y backoff. Destroy de ruta cancela timers. Tests cubren reload en ambas fases, evento final perdido, WebSocket caído, respuesta HTTP posterior al evento y dos pestañas.

### Paridad visual reproducible

Las fixtures HTTP/WS compartidas viven en `e2e/inbox/fixtures`; `e2e/inbox/scenes.json` enumera cada escena. El runner del repo destino levanta el checkout legacy sin modificarlo, intercepta red con las mismas fixtures y captura **primero** `e2e/inbox/legacy-snapshots`. Fija commit legacy, SHA-256 de fixtures, comando, Chromium/WebKit, DPR 1, `es-CL`, `America/Santiago`, reloj, fuentes, reduced motion, viewport y tema en `e2e/inbox/legacy-baseline.manifest.json`.

Luego ejecuta las mismas escenas contra target y compara pares legacy/target en 320×720, 390×844, 768×1024 y 1440×900, claro/oscuro. `maxDiffPixelRatio=0.005`, threshold 0,2; solo se enmascara audio nativo. Los scripts son `e2e:inbox:capture-legacy` y `e2e:inbox:compare`. Un baseline generado desde target no es aceptable. Excepciones registran selector, píxeles/contraste, motivo de seguridad/accesibilidad y aprobación.

## Adjuntos con integridad

`checksumSha256` se representa siempre como Base64 canónico del digest SHA-256 de 32 bytes, no hex. Preparación valida todo antes de escribir y crea UPLOAD_BATCH + 1–20 UPLOAD en una TransactWrite. Reserva liga ownerUserId, teléfono, generation, batchId, ordinal, key, nombre, MIME, tamaño, checksum, hash de request, clientMessageId y vigencia 300 s. Cada URL PUT se prefirmará con checksum SHA-256 y exige que el navegador envíe exactamente `Content-Type`, `x-amz-checksum-sha256:<checksumSha256>` y `x-amz-meta-upload-id:<uploadId>` devueltos en `requiredHeaders`; `Content-Length` no se incluye en SignedHeaders. Fallo de firma de una URL invalida el lote completo.

Confirmación compara owner/teléfono/generation/ID/key; mismatch responde 404. Antes de cualquier Range GET, `HeadObject` con `ChecksumMode:'ENABLED'` exige `ContentLength=size`, `ContentType=mimeType`, `ChecksumSHA256=checksumSha256` y `Metadata['upload-id']=uploadId`; ausencia o diferencia responde 422 `INBOX_UPLOAD_CONTENT_INVALID` y no consume reserva. Después `GetObject` con `Range: bytes=0-4095` obtiene cabecera y, cuando el formato lo exige, otro rango de hasta 4096 bytes desde el final; ambos bodies se cierran siempre. Se validan PDF `%PDF-` y `%%EOF`, JPEG SOI/EOI, PNG signature+IHDR, GIF87a/89a+dimensiones, WebP RIFF/WEBP y tamaño declarado, OGG page header/segment table y WebM EBML/doctype. Firma ajena al MIME, estructura truncada, longitudes imposibles o polyglot con cabeceras top-level contradictorias responde 422 antes de `reserved→consumed`. La Lambda recibe `s3:GetObject` —acción IAM que autoriza tanto `HeadObject` como `GetObject`— solo sobre el prefijo temporal y no sobre assets permanentes.

CORS permite orígenes Hub dev/prd, `PUT,HEAD`, headers exactos `Content-Type,x-amz-checksum-sha256,x-amz-meta-upload-id`, expone `ETag,x-amz-checksum-sha256` y MaxAge 300; nunca `*` ni Authorization. Se extiende `S3BucketConfig.cors` con `exposedHeaders:string[]` y `s3/serverless.ts` emite `ExposedHeaders`; tests inspeccionan el template, preflight real y rechazo al alterar cada header firmado.

## Workflows y agente

DynamoDB Stream enruta INSERT/MODIFY de OUTBOX due. Realtime usa grouping por stream; workflows usan aggregate explícito. `cleanupworker` y `recoveryworker` se ejecutan además por EventBridge Scheduler cada minuto, recorren exactamente shards 00..0F con Query y reprograman pendientes bajo lease; el trigger de Stream es optimización de latencia, no única recuperación. Consumidores usan lease, idempotencia y `batchItemFailures`; nunca envían manualmente a DLQ. SQS fuente retiene 4 días, DLQ 14 y maxReceiveCount 5; DynamoDB Streams se asume solo dentro de su retención administrada y no como archivo durable.

`POST /webhooks/whatsapp` lee el cuerpo crudo una sola vez con `io.LimitReader` a 1 MiB + 1 byte, antes de cualquier bind/parse. Si excede 1 MiB responde 413 `VALIDATION_INPUT_INVALID` sin calcular HMAC ni parsear. Exige exactamente una instancia de `X-Hub-Signature-256` con formato `sha256=<64 caracteres hex minúsculos>`; ausente, duplicada o malformada responde 200 `{data:{status:'ignored'}}`. Obtiene `appSecret` desde SSM; indisponibilidad es 503 `INBOX_CAPACITY_UNAVAILABLE` para que Meta reintente. Calcula HMAC-SHA256 sobre los bytes exactos de `rawBody`, decodifica ambos digests y usa `hmac.Equal`; firma distinta retorna 200 ignored, warn con traceId sin firma/body. Solo tras validar firma parsea el envelope mínimo de Meta, tolera campos adicionales del proveedor y mapea únicamente campos conocidos a un DTO interno cerrado; JSON vacío/malformado o evento irrelevante retorna 200 ignored sin writes. JSON válido reserva META_MSG y OUTBOX transaccionalmente. Tests firman variantes con whitespace/orden distintos, firma alterada, mayúsculas, cabecera duplicada, body vacío, límite exacto/+1 y SSM indisponible.

Webhook reserva META_MSG y OUTBOX transaccionalmente. Para audio entrante se adopta el límite documentado por WhatsApp Cloud API para audio, **16 MiB**; el diseño no impone los 10 s no presentes en legacy. Antes de descargar se valida metadata/tamaño del media y durante streaming se usa `io.LimitReader` de 16 MiB+1; `audio/ogg` y `audio/webm` son aceptados y normalizados para Transcribe. Si falta tamaño, el stream decide; si excede, se cierra el body, se persiste el mensaje entrante y su metadata sin URL, la conversación queda `derived` con razón técnica sanitizada, no se invoca Transcribe/Gemini y el webhook sigue 200 porque el mensaje ya fue preservado. Error temporal al descargar/transcribir reintenta por due-queue; agotamiento deriva a humano. Transcribe `es-US` tiene timeout de workflow 45 s, pero no límite funcional de duración agregado por Inbox. Los tests cubren 7 MiB, 7 MiB+1, 16 MiB, 16 MiB+1, content-length ausente, OGG y WebM; salida preparada permanece limitada a 7 MiB. Se conservan debounce 2500 ms, rate 5/60 s, truncado 800, historial 20 turnos, derivaciones y delivery.

Meta Graph API v21.0: texto/media, upload media y descarga entrante. Clasificación: 4xx definitivo → failed; 408/429/5xx confirmado o fallo antes de bytes → failed_retryable; WAMID y persistencia fallida → recovering; transmisión posible sin respuesta → uncertain. Solo retry explícito una vez.

Gemini usa `gemini-3.1-pro-preview-customtools`, temperature 0.35, topP 0.95, timeout 30 s, máximo dos intentos solo sin respuesta. Parte `agent.enabled=false`; si modelo/cuota no están disponibles deriva a humano. Se reimplementan nueve tools: presupuestos, datos de reunión, disponibilidad, crear/listar/editar/cancelar reunión, certificado Sernatur y sin_respuesta. Agenda: duración/slots 90 min, anticipación 120 min, `America/Santiago`, lunes-viernes 10–22, sábado 10–14, sin domingos/feriados. Google Calendar v3 queda detrás de cliente inyectable.

Corpus anonimizado `testdata/agent-parity/v1` valida tools, argumentos, efectos y textos deterministas; validación real tres veces, 100 % efectos, cero hechos prohibidos y aprobación humana. Cambiar modelo/prompt invalida informe.

## Migración, corte y rollback verificable

`cmd/migrate-inbox` soporta `legacy-to-target|target-to-legacy`, `--dry-run`, `--since`, `--until`, `--checkpoint-file`, `--legacy-profile/region/table/bucket`, `--target-profile/region/table/bucket` y `--manifest`; valida cuentas y regiones antes de leer. No usa Scan. Legacy→target consulta `PK=CHATS` paginado y luego cada `PK=CONV#<phone>` dentro de `[since,until]`; target→legacy consulta las 16 particiones versionadas y cada conversación. Agente, callbacks, writers administrativos y realtime destino permanecen apagados durante carga inicial.

### Transformación implementable y reversible

Cada ítem se transforma primero a un modelo canónico neutral y desde allí al destino. Las reglas son cerradas:

| Fuente legacy | Modelo canónico / destino | Regla, default y rechazo |
|---|---|---|
| `CHATS/CONV#phone` | `CONV#phone/META` + primera LIST/SEARCH | `phone <- item.phone || sk`; quitar un `+`, exigir 8–15 dígitos. `alias <- contactName || phone`; `channel <- channel || 'whatsapp'`, solo whatsapp. `lastMessagePreview <- lastMessage || null`; `lastMessageAt <- RFC3339 válido o null`; `createdAt <- RFC3339 válido o lastMessageAt`; `updatedAt <- RFC3339 válido o lastMessageAt||createdAt`; `unreadCount <- max(0,entero o 0)`; `status <- bot|derived`, default bot; reason/reasonLabel solo para derived y se normalizan al enum conocido o se registran como error no migrado. `generation=1`, tombstone=false. |
| `CONV#phone/CONV#phone` | merge de `CONV/META` | Completa solo campos ausentes de CHATS con `phoneNumber`, `contactName`, `channel`, `lastMessageText`, `lastMessageAt`, `createdAt`, `updatedAt`, `unreadCount`, `status`, `reason`; CHATS gana para la vista. Diferencias quedan en manifest. Si existe CONV sin CHATS, se crea conversación con esos fallbacks; CHATS sin CONV también es válido. |
| `CONV#phone/MSG#uuidv7` | `CONV#phone/MSG#ulid` | `type`: user→customer, model→ai_agent, team→team; otro role se rechaza. `content <- parts[0].text`, null si vacío, máximo 4096 conservando caracteres. `createdAt` debe ser RFC3339 o extraíble del UUIDv7. Se conservan `whatsappMessageId`, delivery `sent|delivered|read|failed`, failure sanitizada a 200 y `metaMessageId`. `attachments[]` conserva orden, máximo 20, nombre/MIME/size/checksum; URL legacy nunca se copia como URL pública: se resuelve/copia el objeto y se guarda key destino. |
| `META_MSG#messageId/META` | `META_MSG#messageId/META` | Conserva messageId, phone, referencia al msgSk transformado y createdAt; TTL se recalcula desde createdAt+7d. Índice huérfano o conflicto con mensaje distinto se rechaza. |
| `WAMID#wamid/META` y campos MSG | `WAMID#wamid/META` | Conserva wamid, phone y msgSk transformado; estado final se toma del MSG y aplica orden monótono sent<delivered<read, mientras failed es terminal. Índice huérfano se rechaza. TTL createdAt+90d. |
| ausencia legacy de SEND | SEND terminal sintetizado solo para salientes con WAMID | `clientMessageId` determinista UUIDv5(namespace inbox-migration, `phone|legacyMsgSk`), estado committed, retryCount 0 y resultado WAMID/msgSk; no se inventan SEND no terminales. |
| delete/tombstone target | ausencia legacy + entrada de manifest | target→legacy elimina CHATS/CONV solo cuando el tombstone/generation es posterior al cutoff aplicado; legacy→target no inventa tombstones. |
| adjunto | objeto S3 destino/legacy + descriptor | Se obtiene por key/URL legacy permitida dentro del bucket configurado, streaming con límite 16 MiB, se calcula SHA-256 y se copia a key determinista `inbox-migration/<phoneHash>/<messageId>/<ordinal>/<safeName>`. Si falta objeto, MIME no permitido, checksum difiere o tamaño excede, la conversación no se marca completa y el corte se bloquea. Target→legacy copia al bucket legacy y emite exactamente `{url,fileName,mimeType}` compatible. |

El ULID de cada mensaje es determinista: timestamp de 48 bits tomado primero de `createdAt` válido y, si falta, del UUIDv7 de `MSG#`; los 80 bits de entropía son los primeros 80 bits de `SHA-256(direction|sourceTableArn|pk|sk|ordinal)`. Si dos claves producen el mismo ULID, se incrementa `ordinal` desde 1 y se rederiva; el mapa de colisión queda en el manifest y el orden lexicográfico de fuentes hace la resolución repetible. Si no existe timestamp recuperable, el registro se rechaza: no se usa reloj de ejecución.

El checkpoint JSON cerrado y escrito atómicamente contiene `{schemaVersion:'1.0',direction,sourceTableArn,targetTableArn,since,until,phase,chatsLastEvaluatedKey,currentPhone,conversationLastEvaluatedKey,shardLastEvaluatedKeys,attachmentCursor,counts,rollingHash,lastCommittedSourceKey}`. Guarda LEK como DynamoDB AttributeValue serializado, nunca cursor inventado. Se actualiza solo después de confirmar el lote target y objetos S3; reanudar exige mismos argumentos/ARN/hash de configuración. Cada Put target usa `attribute_not_exists` o condición `migrationChecksum=:same`; mismo checksum es éxito idempotente, distinto checksum aborta. Los lotes respetan 100 acciones/4 MiB y no avanzan LEK ante resultado incierto hasta releer todos los ítems.

La canonicalización para checksums usa RFC 8785 JCS sobre registros neutrales `{entityType,sourceKey,phone,generation,id,createdAt,payload,attachments:[{ordinal,fileName,mimeType,size,sha256}]}`; excluye PK/SK físicos, TTL, URLs firmadas, tiempos de migración y campos vacíos equivalentes, y ordena registros por `entityType|phone|id` y adjuntos por ordinal. SHA-256 se acumula por conversación y entidad. El manifest cerrado registra dirección, ARNs/buckets, ventana, commit de migrador, conteos CHATS/CONV/MSG/META_MSG/WAMID/SEND/attachments/tombstones, fecha mínima/máxima, hashes canónicos por entidad y global, colisiones, errores no migrados y sus source keys hasheadas. `dry-run` produce el mismo manifest sin writes. El corte exige cero errores, conteos esperados y que legacy→neutral y target→neutral coincidan; rollback aplica target→legacy y vuelve a comparar ambos manifests. Tests fixture cubren nulls, defaults, arrays de adjuntos, UUIDv7→ULID, colisión forzada, LEK entre páginas, crash/reanudación y conflicto de checksum.

### Journal fuerte de rollback

`gsi-rollback-index` puede mantenerse solo para diagnóstico; **no** prueba completitud. Cada transacción funcional reserva optimistamente un `rollbackSequence` global en `SEQ#ROLLBACK/META` dentro de la misma TransactWrite y escribe:

- header `ROLLBACK_BUCKET#<yyyyMMddHH>#<shard>/SEQ#<sequence>#HEADER`, con cantidad y hash de filas;
- una fila por CONVERSATION, MESSAGE, WAMID, META_MSG, SEND, ATTACHMENT_REF o CALENDAR_REF, `SEQ#<sequence>#<ordinal>#<type>#<id>`, con imagen/tombstone, checksum, phone y generation. ATTACHMENT_REF contiene solo bucket/key/size/checksum/MIME, nunca URL firmada; CALENDAR_REF contiene calendarId/eventId/acción y metadata funcional, nunca OAuth.

El shard deriva de sequence y el bucket de la hora UTC. Ningún write de esos tipos es válido sin header+filas en la misma transacción. El exportador enumera horas/shards conocidos desde el registro de cutover, hace Query base con `ConsistentRead=true`, une por sequence, exige continuidad desde `cutoverBaseSequence+1` hasta `rollbackCutoffSequence`, verifica cantidad/hash de cada header y genera manifest global firmado por SHA-256. No avanza un watermark por un GSI ni usa pasadas vacías como prueba.

Rollback usa dos deltas y evita una ventana sin correlación. Primero bloquea UI/agente y nuevos envíos, drena OUTBOX, exige cero SEND no terminales y resuelve `uncertain`; el webhook target sigue activo. Con writers salientes bloqueados registra `rollbackPreseedCutoffSequence`, exporta consistentemente hasta allí y **preaplica en legacy WAMID, SEND sintetizable y mensajes salientes asociados**, incluyendo su estado monótono actual, sin cambiar todavía el callback. Verifica por GetItem que todo WAMID target tiene índice legacy válido; cualquier ausencia bloquea.

Solo entonces cambia el callback Meta a legacy y verifica handshake/firma y que el contador ingress target permanece en cero durante la ventana operativa definida. Desde ese instante legacy ya puede correlacionar `delivered/read/failed` tardíos. Se cierran invocaciones en vuelo target, se fija `rollbackFinalCutoffSequence` y se exporta/aplica el delta final META_MSG, MESSAGE, CONVERSATION, WAMID y estados. La fusión de delivery es condicional: sent<delivered<read y nunca retrocede; `failed` solo se aplica si no existe delivered/read posterior, y un failed ya terminal no se reemplaza. Redelivery de ambos deltas es idempotente por checksum/source sequence.

Calendar conserva el mismo `calendarId` y las tools target escriben exactamente las claves de metadata por teléfono/meetingId que consulta legacy; el preflight ejecuta `calendars.get` y fixtures create/edit/cancel en sandbox. Si se reutiliza calendario, no se copia el evento: el delta exporta metadata y verifica que cada eventId existe. Si no puede reutilizarse, rollback queda bloqueado hasta copiar/compensar eventos y verificar asistentes/horas; no se cancela silenciosamente. Para adjuntos, el manifest final enumera cada objeto aún referenciado con bucket/key/size/SHA-256; antes de habilitar legacy los copia a un prefijo permitido del bucket legacy, verifica checksum y transforma la referencia a `{url,fileName,mimeType}`. Un objeto ausente bloquea rollback: no se degrada a “no descargable” sin excepción aprobada.

El runbook prueba explícitamente carreras: delivery entre preseed y callback, delivery después del callback antes del delta final, inbound en vuelo target, redelivery del mismo webhook, reunión creada/editada/cancelada y adjunto leído tras rollback. Solo después de hashes, objetos, Calendar y smoke legacy exitosos se cierra mantenimiento. Cualquier hueco, hash distinto o SEND no terminal mantiene mantenimiento; nunca hay dos agentes/escritores.

Delete incrementa generation, escribe tombstone/versiones/journal. Cleanup pagina por Query y elimina solo con `generation<=deletedGeneration`; una recreación concurrente sobrevive.

## Infraestructura, SSM y obtención desde legacy

Se modifican `ddb/ddb-config.ts`, `s3/s3-config.ts`, `s3/serverless.ts`, `ssm/ssm-config.ts`, `scripts/ssm-apply-securestring.ts`, `scripts/deploy-all.sh`, `scripts/remove-all.sh`, `scripts/deploy-resource.ts`, `Makefile`, `package.json`, tests y `environments/.env.example`. Se crean `websocket/websocket-config.ts`, `websocket/serverless.ts` y `scripts/import-inbox-legacy-config.ts`. Buckets privados/cifrados; temporal lifecycle un día; assets versionado y Retain. SQS, DLQ, mappings y Lambdas viven en api-inbox. Costos variables y límites se documentan en `docs/cost/inbox.md`; no se asume gratuidad de Transcribe, Gemini, WebSocket ni proveedores.

`websocket` se registra como recurso válido en ayuda/check del Makefile, scripts npm `deploy:websocket:{dev,prd}`, fase 1 de `deploy-all.sh` y primero en `remove-all.sh` **solo después** de un preflight que comprueba que el stack `api-inbox-${stage}` no existe; si existen rutas externas, remove-all aborta e indica remover `api-inbox` primero. `serverless print` y Vitest validan nombres/outputs, Stage AutoDeploy, logs y throttling. El orden completo es authorizer → infraestructura DDB/S3/SSM/websocket/API Gateway → api-inbox; la remoción invierte servicio → websocket → resto.

La entrada local es `infrastructure/environments/.env.dev`, ignorada, modo 600. `.env.example` solo contiene placeholders. Todos los parámetros Inbox se registran `type:'SecureString'`, `secureOnly:true`; `META_PAGE` es además `optional:true`:

| Variable local | Ruta SSM |
|---|---|
| `SSM_INBOX_WHATSAPP_CONFIG` | `/indomito/{stage}/inbox/whatsapp-config` |
| `SSM_INBOX_GEMINI_CONFIG` | `/indomito/{stage}/inbox/gemini-config` |
| `SSM_INBOX_AGENT_CONFIG` | `/indomito/{stage}/inbox/agent-config` |
| `SSM_INBOX_ASSET_CONFIG` | `/indomito/{stage}/inbox/asset-config` |
| `SSM_INBOX_MEETING_CONFIG` | `/indomito/{stage}/inbox/meeting-config` |
| `SSM_GOOGLE_CALENDAR_OAUTH` | `/indomito/{stage}/google/calendar-oauth` |
| `SSM_INBOX_META_PAGE_CONFIG` | `/indomito/{stage}/inbox/meta-page-config` (opcional y apagado) |
| `SSM_INBOX_CURSOR_SECRET` | `/indomito/{stage}/inbox/cursor-secret` |
| `SSM_INBOX_RUNTIME_CONFIG` | `/indomito/{stage}/inbox/runtime-config` |

Los schemas JSON son cerrados y versionados en el importador/validador: WhatsApp `{accessToken,phoneNumberId,verifyToken,appSecret}`; Gemini `{apiKey,model,temperature,topP}`; Agent `{enabled,debounceMs,rateLimitMax,rateLimitWindowSeconds,maxMessageLength,maxHistoryTurns,enabledChannels}`; Asset `{budgetBucketName,budgetPrefix,budgetExceptionsPrefix,sernaturCertificateKey}`; Meeting `{calendarOAuthParameterPath,calendarId,timezone,defaultGuestEmails,defaultHostSk,defaultHostName,slotDurationMinutes,minAdvanceMinutes,weekdayStartHour,weekdayEndHour,saturdayStartHour,saturdayEndHour}`; Google Calendar OAuth `{client_id,client_secret,refresh_token}` conservando los nombres exigidos por el cliente Google; Runtime `{maxMaterializableConversations,dueQueueShards,workerQueryLimit}`; Cursor `{current,previous,rotatedAt}`. Runtime exige entero `maxMaterializableConversations>=20000`, `dueQueueShards=16` y `workerQueryLimit=100`; cambiar shards requiere migración explícita de due-queues. `enabledChannels` debe ser exactamente `['whatsapp']`; `previous` es Base64 o null. Campos desconocidos, faltantes, tipos/rangos inválidos o placeholders abortan antes de cualquier `put-parameter`.

### Matriz de trazabilidad de configuración

La columna “origen” identifica archivo/path, no incluye valores. `copiar` significa transformar una credencial existente; `generar` usa CSPRNG; `default` reproduce una constante legacy confirmada.

| envVar destino | JSON path destino | Origen legacy exacto | Transformación/validación | Acción | Obligatorio | Verificación |
|---|---|---|---|---|---|---|
| `SSM_INBOX_WHATSAPP_CONFIG` | `$.accessToken` | SSM `/pa/{stage}/whatsapp-config` → `$.access_token`; consumido en `helpers/whatsapp-api.js` | snake_case→camelCase; string 1–4096 | copiar | sí | metadata SSM + llamada Meta `/me` redactada |
| mismo | `$.phoneNumberId` | mismo SSM → `$.phone_number_id` | string dígitos 1–64 | copiar | sí | consultar metadata del phone number sin token en logs |
| mismo | `$.verifyToken` | mismo SSM → `$.verify_token`; `functions/verificacion-webhook-v1.js` | string 16–256 | copiar | sí | handshake de prueba |
| mismo | `$.appSecret` | mismo SSM → `$.app_secret`; `validators/validate-webhook-payload.js` | string 16–512 | copiar | sí | fixture HMAC válida/inválida |
| `SSM_INBOX_GEMINI_CONFIG` | `$.apiKey` | SSM `/pa/{stage}/gemini-api-key` → `$.api_key`; `helpers/gemini-agent.js` | snake_case→camelCase; string no vacío | copiar | sí para agente | request mínimo sin imprimir key |
| mismo | `$.model` | `helpers/gemini-agent.js` `getGenerativeModel.model` | literal permitido `gemini-3.1-pro-preview-customtools` | default | sí | test de schema/paridad |
| mismo | `$.temperature` | `helpers/gemini-agent.js` `generationConfig.temperature` | number 0–2; valor legacy 0.35 | default | sí | test de schema/paridad |
| mismo | `$.topP` | `helpers/gemini-agent.js` `generationConfig.topP` | number 0–1; valor legacy 0.95 | default | sí | test de schema/paridad |
| `SSM_INBOX_AGENT_CONFIG` | `$.enabled` | no existe flag legacy equivalente | false hasta gate/cutover | default | sí | deploy inicia agente apagado |
| mismo | `$.debounceMs` | `serverless.yml` `AGENT_DEBOUNCE_MS`; `helpers/agent-debounce.js` | integer 0–10000; 2500 | copiar | sí | test reloj inyectado |
| mismo | `$.rateLimitMax` | `functions/ejecutar-agente-v1.js` `RATE_LIMIT_MAX` | integer 1–100; 5 | default | sí | sexto mensaje en 60 s no dispara agente |
| mismo | `$.rateLimitWindowSeconds` | `functions/ejecutar-agente-v1.js` `RATE_LIMIT_WINDOW_SEC` | integer 1–3600; 60 | default | sí | test borde 59/60 s |
| mismo | `$.maxMessageLength` | `functions/ejecutar-agente-v1.js` `MAX_MESSAGE_LENGTH` | integer 1–4096; 800 | default | sí | test 800/801 caracteres |
| mismo | `$.maxHistoryTurns` | `functions/ejecutar-agente-v1.js` `MAX_HISTORY_TURNS` | integer 1–100; 20 | default | sí | test contexto 20/21 |
| mismo | `$.enabledChannels` | `serverless.yml` `ENABLE_META_CHANNELS:'false'` y `procesar-mensaje-v1.js` | exactamente `['whatsapp']` | default | sí | Messenger/Instagram ignorados |
| `SSM_INBOX_ASSET_CONFIG` | `$.budgetBucketName` | `serverless.yml` `BUCKET_INFO_GI` para inspección/copia; destino output `InboxAssetsBucketName` | no copiar nombre legacy; usar bucket destino y validar DNS | generar | sí | HeadBucket destino y cuenta/región esperadas |
| mismo | `$.budgetPrefix` | `tools/buscar-presupuestos.js` `presupuestos/${region}/` | prefijo fijo `presupuestos/`, sin `/` inicial ni `..` | default | sí | manifest/listado Query S3 por prefijo + checksums |
| mismo | `$.budgetExceptionsPrefix` | `tools/buscar-presupuestos.js` `presupuestos/excepciones/${ciudad}/` | prefijo fijo `presupuestos/excepciones/` | default | sí | copia objeto a objeto + SHA-256 |
| mismo | `$.sernaturCertificateKey` | `helpers/send-certificado-sernatur.js` `SERNATUR_CERTIFICATE_S3_KEY` | key fija `legales/certificado-sernatur.pdf` | default | sí | HeadObject, PDF magic y SHA-256 |
| `SSM_GOOGLE_CALENDAR_OAUTH` | objeto completo | SSM `/pa/{stage}/google-calendar-oauth` con `client_id`, `client_secret`, `refresh_token`; consumido por helpers Calendar legacy | validar objeto cerrado, cada string 1–4096; no transformar nombres; escribir en variable separada que infraestructura ya mapea a `/indomito/{stage}/google/calendar-oauth` | copiar | sí para agenda | metadata SecureString destino + refresh/calendars.get sin log de tokens |
| `SSM_INBOX_MEETING_CONFIG` | `$.calendarOAuthParameterPath` | `serverless.yml` `GOOGLE_CALENDAR_OAUTH_SECRET_KEY` → `/pa/{stage}/google-calendar-oauth` | fijar `/indomito/{stage}/google/calendar-oauth` y exigir que `SSM_GOOGLE_CALENDAR_OAUTH` forme parte del mismo lote | default | sí para agenda | preflight metadata del parámetro destino y refresh token test |
| mismo | `$.calendarId` | `serverless.yml` `GOOGLE_CALENDAR_ID` | string 1–320 con `@` o `primary`; copiar literal vía importador, no documento | copiar | sí | Calendar v3 `calendars.get` |
| mismo | `$.timezone` | `serverless.yml` `TIMEZONE` | IANA; `America/Santiago` | default | sí | carga `time.LoadLocation` |
| mismo | `$.defaultGuestEmails` | `serverless.yml` `MEET_DEFAULT_GUEST_EMAILS` | array 0–20 emails, minúsculas/dedupe | copiar | sí | schema + evento sandbox |
| mismo | `$.defaultHostSk` | `serverless.yml` `MEET_DEFAULT_HOST_SK` | string 1–256; copiar solo si host existe en destino | copiar | sí | GetItem/Query del host destino |
| mismo | `$.defaultHostName` | `serverless.yml` `MEET_DEFAULT_HOST_NAME` | trim 1–100 | copiar | sí | coincide con host resuelto |
| mismo | `$.slotDurationMinutes` | `helpers/gemini-agent.js` prompt: “Cada reunión dura 1 hora 30 minutos” | integer 15–240; 90 | default | sí | test slots |
| mismo | `$.minAdvanceMinutes` | `helpers/gemini-agent.js` prompt: “Anticipación mínima: 2 horas” | integer 0–10080; 120 | default | sí | test borde |
| mismo | `$.weekdayStartHour/weekdayEndHour` | `helpers/gemini-agent.js` prompt lunes-viernes 10:00–22:00 | enteros 0–23; 10/22 | default | sí | test disponibilidad |
| mismo | `$.saturdayStartHour/saturdayEndHour` | `helpers/gemini-agent.js` prompt sábado 10:00–14:00 | enteros 0–23; 10/14 | default | sí | test sábado/domingo |
| `SSM_INBOX_CURSOR_SECRET` | `$.current` | sin origen legacy | 32 bytes CSPRNG, Base64; nunca reutilizar JWT | generar | sí | decode longitud 32, checksum manifest |
| mismo | `$.previous` | sin origen legacy | null inicial; en rotación recibe current anterior | generar | sí | test rotación y gracia |
| mismo | `$.rotatedAt` | reloj UTC de importación/rotación | RFC3339 UTC | generar | sí | parse estricto |
| `SSM_INBOX_RUNTIME_CONFIG` | `$.maxMaterializableConversations` | sin valor legacy; resultado del load test y conteo preflight | entero >=max(20000,ceil(activeCount×1.25)); el importador propone, operador aprueba | generar | sí | load test + alarmas 80/90/100 % |
| mismo | `$.dueQueueShards` | decisión de diseño | constante 16 | default | sí | tests consultan exactamente 00..0F |
| mismo | `$.workerQueryLimit` | límite de worker | constante 100 | default | sí | test paginación/lease |

`SSM_INBOX_META_PAGE_CONFIG` solo se importa desde `/pa/{stage}/meta-page-config` si una decisión posterior habilita canales; en esta migración permanece ausente y `enabledChannels=['whatsapp']`. `/pa/{stage}/jwt-key` se consulta únicamente sin `--with-decryption` para auditoría y jamás aparece en `.env.dev`, manifest o SSM destino.

### Importación segura

Primero se consulta metadata sin revelar valor:

```bash
aws ssm get-parameter \
  --name '/pa/dev/whatsapp-config' \
  --profile pa-dev --region us-west-2 \
  --query 'Parameter.{Name:Name,Type:Type,Version:Version,LastModifiedDate:LastModifiedDate}' \
  --output json --no-cli-pager
```

Se repite para `/pa/dev/gemini-api-key`, `/pa/dev/google-calendar-oauth`, `/pa/dev/meta-page-config` y `/pa/dev/jwt-key` (este último solo metadata). `scripts/import-inbox-legacy-config.ts --stage dev --legacy-region us-west-2 --target-region us-east-1 --profile pa-dev` obtiene con `--with-decryption` únicamente WhatsApp, Gemini y Google Calendar OAuth requeridos, lee constantes no secretas desde `--legacy-root`, transforma según la matriz y escribe **solo** `environments/.env.dev` mediante temporal, `fsync`, `rename` y modo `0600`. Debe producir explícitamente `SSM_GOOGLE_CALENDAR_OAUTH=<JSON cerrado>` y `SSM_INBOX_MEETING_CONFIG.calendarOAuthParameterPath='/indomito/dev/google/calendar-oauth'` en el mismo lote; si falta o es inválido el OAuth, no escribe ninguna variable Inbox. No hace `put-parameter`, no imprime valores y rehúsa sobrescribir salvo `--overwrite`.

El importador genera al lado `environments/.env.dev.inbox-manifest.json`, también 0600 e ignorado, con nombre de env var, ruta SSM origen/destino, versión SSM origen, acción copiar/generar/default, SHA-256 del valor final y timestamp; nunca contiene valores, longitudes sensibles, emails, IDs o nombres. `ssm-apply-securestring.ts` vuelve a validar schemas cerrados y completitud antes de escribir; si una entrada falla, no aplica **ningún** parámetro Inbox (prevalidación de lote), no imprime valor y termina non-zero. Tras aplicar, un verificador compara versión/tipo/checksum en memoria y borra variables temporales. Los objetos de presupuestos/excepciones/certificado se copian por prefijos acotados con checksum y manifest separado sin URLs firmadas.

## IAM funcional y authorizer

### Authorizer

En `authorizer/src/functions/authorize.ts` se elimina el parámetro `allowUnsignedFallback` y toda autorización mediante `jwt.decode`; decode solo puede inspeccionar issuer para la vía Azure deshabilitada y jamás concede acceso. `jwt.verify` exige `algorithms:['HS256']`, payload cerrado y al menos un secreto válido. Token ausente, `alg:none`, RS256, firma inválida, expirado, SSM ausente/malformado o payload alterado devuelve Deny. Basic se deniega antes de consultar credenciales para prefijos segmentados `/conversaciones`, `/envios-inbox` y `/operaciones-inbox`; fuera de Inbox conserva comportamiento. Matching acepta igualdad, endpoint + `/` o endpoint + `:` y ordena endpoint específico.

Antes de desplegar se agrega un contrato emisor-verificador compartido como fixture JSON versionada en `authorizer/test/fixtures/api-identity-token-payload.json`, idéntica al payload real de `api-identity` (`body.allowances,userId,email,rut,profileCode,endpoints,iat,exp`). El test firma HS256 con fixture de secreto inyectado, ejecuta el handler REQUEST y exige Allow/contexto; negativos alteran body/firma, `alg:none`, RS256, expiración, secreto ausente, `token-secrets` JSON malformado y endpoint/método. Ni fixture ni logs contienen secreto real.

Despliegue seguro DEV: (1) publicar una versión Lambda nueva sin mover alias; (2) invocar test contractual sobre esa versión; (3) mover alias del authorizer; (4) ejecutar login real de `api-identity`, GET protegido de salud/permisos y el mismo GET con un token alterado que debe recibir 401/403, sin imprimir tokens; (5) observar 15 minutos métricas `Allow`, `Deny`, 401/403 y errores SSM comparadas con baseline. Si Deny supera baseline +5 puntos porcentuales o falla el smoke válido, el runbook revierte el alias a la versión anterior; nunca reactiva fallback unsigned. Solo después continúa Gateway/api-inbox.

### Registro completo

`services/scripts/configure-inbox-iam.sh` recibe stage/profile/region, resuelve tabla, usa GetItem/Query —nunca Scan—, verifica perfil `ADMIN` activo y aborta si solo existe `ADM`. Antes del upsert consulta la partición `APP#INDOMITO_HUB`: si order 50 o 51 pertenece a otro código, falla sin elegir otro número.

Objetos completos:

```ts
const communicationsModule = {
  code:'COM', title:'Comunicaciones', category:'Comunicaciones', path:'/comunicaciones',
  icon:'icon-[tabler--messages]', order:50, active:true, endpoints:[],
  tooltip:'Gestión de comunicaciones', color:'emerald', level:'LV1', parentCode:'',
  isDeprecated:false, createdAt:'<RFC3339 preservado o actual>'
};
const inboxModule = {
  code:'INBOX', title:'Conversaciones', category:'Comunicaciones',
  path:'/comunicaciones/conversaciones', icon:'icon-[tabler--message-circle]', order:51,
  active:true, level:'LV2', parentCode:'COM',
  endpoints:['/conversaciones','/envios-inbox','/operaciones-inbox'],
  tooltip:'Gestionar conversaciones de WhatsApp', color:'emerald',
  isDeprecated:false, createdAt:'<RFC3339 preservado o actual>'
};
```

Preserva `createdAt` existente y permisos ajenos. Crea permiso ADMIN LV1 COM `['r']` y LV2 INBOX `['c','r','u','d']`, con parentCode correcto. `r`: lista/detalle/ticket/estado; `c`: responder/adjuntar/audio/retry; `u`: alias/unread/bulk/resolución; `d`: delete. Tras ejecutar dos veces, refresh `/auth/permisos` o nuevo login debe mostrar COM/INBOX en `AuthService.modules()`, que filtra `active`, requiere lectura del padre y ordena por `order`.

## Manejo de errores

- Input inválido: 400 `VALIDATION_INPUT_INVALID` o `VALIDATION_PHONE_INVALID`, recuperable corrigiendo; cursor alterado/mismatch: 400 `VALIDATION_CURSOR_INVALID`; cursor expirado: 400 `INBOX_CURSOR_EXPIRED` y reinicio/reconciliación automática. Log info sin body/cursor.
- JWT o identidad inválidos: Deny/401, reautenticación; warn sin token/PII. Allowance: 403 `AUTH_FORBIDDEN`, fatal para la llamada.
- Snapshot: cuarto slot 429 `INBOX_SNAPSHOT_LIMIT_REACHED` con retry; materialización sin capacidad 503 `INBOX_CAPACITY_UNAVAILABLE`, sin parcial; métrica y warn/error.
- Bulk: operación activa retorna el mismo ID; un chunk recuperable conserva checkpoint/OUTBOX y reintenta; DLQ fija failed y alarma. Ningún retry SQS se usa para continuar normalmente.
- Ticket usado/vencido: handshake 401; pedir otro; info sin ticket.
- Reserva ajena: 404 `INBOX_UPLOAD_NOT_FOUND`; vencida/usada 409 con su código; checksum/metadata/magic inválidos 422 `INBOX_UPLOAD_CONTENT_INVALID`; no se consume.
- Meta definitivo: failed+502 `INBOX_PROVIDER_REJECTED`; seguro antes de bytes/429/5xx: failed_retryable+502; transmisión posible: uncertain+202; WAMID con commit fallido: recovering+202.
- Dynamo/S3/SSM: 500 `INTERNAL_ERROR`, salvo configuración/dependencia temporal de webhook que retorna 503 `INBOX_CAPACITY_UNAVAILABLE`; retry idempotente; error con recurso lógico, sin path secreto.
- Webhook: body >1 MiB retorna 413; secreto SSM no disponible retorna 503; firma ausente/duplicada/malformada/inválida o JSON irrelevante retorna 200 ignored sin writes. Solo invalidez de firma se registra warn y nunca body/header.
- WS 410 elimina conexión; 429/5xx deja dato committed y reintenta fanout dos veces.
- Gemini/Calendar/Transcribe agotado: deriva a humano, DLQ/alarma según workflow.
- Migración/journal checksum o secuencia ausente: proceso non-zero y bloqueo de corte/rollback.

## Pruebas y gates

1. **C0 contratos/costo:** OpenAPI/AsyncAPI completos validan schemas cerrados, ejemplos, refs, discriminadores, `operationId`, `messageId` y catálogo de errores; `contracts:check` exige checkout privado con `IND_HUB_API_READ_TOKEN`, SHA igual a `inbox-contracts.manifest.json.servicesCommit`, hashes de ambos artefactos, URLs AsyncAPI dev/prd iguales a `WebSocketUrl`, rutas Serverless/Go y costo aprobado.
2. **Frontend unitario:** signals/store, fechas, orden, debounce, buffer 200→20, LRU, secuencias, huecos, 79/80/81, prepend, composer, codecs, lotes, optimistic, cinco SendState y cursor expirado con reconciliación. Permisos cubren `canPerform`, directiva y controles por c/r/u/d, módulo inactivo y parent COM sin r. Bulk cubre reload en ambas fases, evento perdido, WS caído, dos pestañas y dos owners distintos, backoff y terminal HTTP/WS fuera de orden.
3. **Frontend visual:** baseline capturado desde commit legacy con fixtures/reloj/fuentes/DPR/tema idénticos y comparación legacy-target completa a 320, 390, tablet y escritorio, claro/oscuro.
4. **Backend:** table-driven + race para inputs, códigos exactos, IdentityFromContext, DTO, fases Meta, versiones LIST/SEARCH, movimientos en páginas 1 MiB, detalle sequence-before-data, SEND_VIEW/due-queue, TTL y adjuntos. Cursor prueba renovación/expiración y cuatro page-1 concurrentes. Capacidad prueba contador create/delete/recreate, alarmas 80/90/100 %, conversación N+1 persistida con webhook 200 y lista/bulk 503 sin parcial ni Scan.
5. **Bulk:** 20.000 targets; mutex global por kind con carreras entre dos owners; respuesta activa en materializing/applying; chunks de 98/99 y límite 4 MiB; única transacción targets+checkpoint+OUTBOX due; crashes antes/después de transacción/trigger/SendMessage; duplicate stream/SQS, applied/unchanged, ledger existente y contadores exactos.
6. **Realtime/WebSocket/workers:** carrera lectura/evento, watermarks, N+1 antes de N en el mismo batch, gap persistido y drenado, pérdida del trigger, due-queue OUTBOX/SEND por Query, lease vencido y recuperación sin Scan. Template CloudFormation comprueba API externo → Route → Integration → Lambda, permisos, Stage único y ManageConnections mínimo.
7. **Webhook y adjuntos:** raw body exacto, HMAC y 1 MiB/+1; incoming audio OGG/WebM en bordes 7/16 MiB y oversize preservado/derivado; outgoing checksum Base64, SignedHeaders, HeadObject antes de Range, headers alterados, preflight y `ExposedHeaders`.
8. **Migración/rollback:** fixtures campo a campo en ambos sentidos, JCS/checksums, ULID determinista, LEK/checkpoint y reanudación idempotente. Rollback prueba preseed WAMID antes de callback, delta final, delivery en ambas ventanas, inbound/redelivery, respuesta, adjunto con checksum, Calendar create/edit/cancel, alias, unread, bulk y delete/recreate.
9. **Infra/SSM/IAM:** DDB/TTL/stream/CONV_COUNT, S3/CORS/lifecycle, SQS/DLQ, registro websocket y guard de remoción. Importador escribe archivo 0600 y manifiesta `SSM_GOOGLE_CALENDAR_OAUTH`; OAuth ausente/inválido produce cero writes. Script IAM dos veces, colisión order, refresh/login ADMIN y COM/INBOX.
10. **Authorizer y validación por repo:** contrato exacto api-identity→REQUEST, negativos `alg:none`/RS256/firma/payload/exp/secreto y smoke DEV válido+alterado con rollback de alias y métricas Deny. Luego `npm test`/build frontend; `go test -race`, vet y make validate services; Vitest infra/authorizer/orchestrator; checks prohíben Scan, JWT en URL/logs y secretos.

Orden de despliegue: authorizer → infraestructura DDB/S3/SSM/websocket/API Gateway → contratos C0 → api-inbox (rutas WebSocket incluidas) → migración → IAM funcional → frontend → cutover → agente.

## Casos límite

- HTTP/WS duplicado se deduplica; list/detail nunca comparten secuencia.
- Mutación posterior al cutoff no reemplaza la versión previa durante materialización.
- Página LIST_RESULT permanece estable durante su ventana renovable; al expirar se reinicia y reconcilia por teléfono sin vaciar filas visibles.
- Bulk 202 siempre posee OUTBOX due durable; mutex global hace converger owners distintos; cada chunk materializa máximo 98 targets con checkpoint y continuación atómicos.
- N+1 recibido antes de N se persiste como gap, el batch ordena N y drena el sufijo; pérdida del trigger se recupera por Query due-queue.
- Al superar capacidad probada, inbound y contador se confirman; lista/bulk fallan 503 recuperable con alarma, nunca Scan ni pérdida.
- TTL no ejecutado aún no habilita ticket/reserva vencida.
- 20 adjuntos reservan todos; 21 o condición fallida reservan cero.
- Header válido pero tail truncado, MIME falso o polyglot contradictorio se rechaza antes de consumir.
- Delete/recreate queda aislado por generation.
- Rollback no concluye por “dos pasadas vacías”; exige cutoff cerrado, continuidad y hashes.
- Safari usa WebM fallback; sin MediaRecorder conserva texto/adjuntos.
- Feriados ausentes no producen un slot dudoso.

## Fuera de alcance

- Copiar código, HTML, estilos o secretos legacy literalmente.
- Habilitar Messenger/Instagram.
- Crear perfil `ADM` o mover Inbox bajo Administración.
- Cambiar almacenamiento de sesión frontend preexistente.
- Resolver uncertain desde una UI nueva; se usa endpoint/runbook autenticado.
- Ejecutar el corte productivo durante la implementación.
- Sustituir Gemini por otro modelo sin caracterización aprobada.

Sí están dentro de alcance los 90 días de datos, agente/tools, presupuestos, reuniones, certificado, audio, realtime, contratos, infraestructura segura e IAM ADMIN.

## Respuesta a la revisión fresh y design-gate

1. **HIGH — snapshot mutable: atendido.** LIST, SEARCH y resumen son versiones por secuencia; cutoff se captura antes, se elige última versión elegible y LIST_RESULT guarda resúmenes congelados. Se prueban cambios entre páginas de 1 MiB.
2. **HIGH — bulk sin disparador durable: atendido y reforzado por el gate vigente.** La TransactWrite inicial crea OUTBOX y cada fase/checkpoint crea su propia continuación durable; stream+lease recuperan crash entre commit y enqueue.
3. **HIGH — branching transaccional imposible: atendido.** Se definen transacciones applied/unchanged separadas, relectura consistente y ledger existente como éxito previo.
4. **HIGH — rollback sobre GSI eventual: atendido.** La fuente es ROLLBACK_BUCKET base con Query consistente, secuencia global, headers, continuidad y manifest/hash hasta cutoff cerrado; GSI es solo diagnóstico.
5. **HIGH — watermark y grouping: atendido.** Todo detalle captura secuencia antes de cualquier dato y retorna ese valor; realtime usa MessageGroupId=stream y cursor de dispatch por stream.
6. **MEDIUM — pipeline contractual: atendido.** Se elige sincronizador directo sobre merge-logic, services-root obligatorio, escritura atómica, scripts npm y workflows exactos con checkout explícito.
7. **MEDIUM — SendState reload: atendido.** Tabla exhaustiva para reserved, provider_pending, recovering, uncertain y failed_retryable; backoff repite 15 s hasta 15 min y CTA única queda cerrada.
8. **MEDIUM — HeadObject/magic bytes: atendido.** Head valida metadata; GetObject Range de cabecera/cola valida firma y estructura antes del consumo, con permiso mínimo y pruebas adversariales.
9. **MEDIUM — TTL: atendido.** UPLOAD_BATCH, SEQ sin TTL y ventana rollback 14 días + margen 7 días quedan normativos.
10. **MEDIUM — IAM incompleto: atendido.** COM/INBOX incluyen category, path, icon, order, active, endpoints, tooltip, color, level, parent e isDeprecated; colisión aborta y login/refresh se prueba.
11. **MEDIUM — scroll histórico: atendido.** Umbrales 80/96/160/80, transición nativo↔virtual, preservación de ancla y tests 79/80/81 quedan fijados.
12. **MEDIUM — baseline visual: atendido.** El baseline proviene del legacy con fixtures y entorno idénticos; manifiesto registra commit/hash/comando y la comparación es legacy-target.
13. **MEDIUM — identidad inexistente: atendido.** Se define AuthorizerIdentity/IdentityFromContext, obligatoriedad, normalización, límites, compatibilidad y tests de contexto malformado.

No se posterga ni ignora ningún hallazgo HIGH o MEDIUM de esa revisión.

### Respuesta a `design-review-fresh.md` / gate vigente

1. **HIGH — mutex bulk por owner: atendido.** `BULK_ACTIVE` ahora es global por `APP#INDOMITO_HUB` y kind; carreras entre usuarios convergen y PATCH/GET devuelven la `BulkOperation` completa en materializing o applying a cualquier caller con `u`.
2. **HIGH — chunk bulk no atómico: atendido.** Materialización limita 98 targets y confirma hasta 98 Put + Update BULK + Put OUTBOX due en una única transacción de máximo 100 acciones/4 MiB; resultado incierto se resuelve por checkpoint/hash determinista. Se prueban 98/99 y crashes.
3. **HIGH — workers no consultables y secuencias invertidas: atendido.** OUTBOX pending vive en 16 due-shards base y SEND mantiene proyección due transaccional; workers usan Query+lease. El router agrupa/ordena batches, persiste gaps y drena secuencias contiguas sin depender de Streams ni Scan.
4. **HIGH — rollback pierde delivery y efectos: atendido.** Se preaplican WAMID/SEND antes de mover callback y luego se aplica delta final con delivery monótono. Journal/runbook incluyen ATTACHMENT_REF y CALENDAR_REF, copia/verificación S3 y compatibilidad Calendar.
5. **HIGH — migración no implementable: atendido.** Se agrega matriz CHATS/CONV/MSG/META_MSG/WAMID/SEND/tombstone/adjunto en ambos sentidos, ULID determinista, checkpoint con LEK, writes condicionales y manifest JCS con conteos/hashes/errores.
6. **MEDIUM — límites de adjuntos contradictorios: atendido.** `Message`/realtime usan arrays y admiten historial entrante hasta 16 MiB; preparación saliente conserva 7 MiB. OpenAPI enumera PDF/imágenes/OGG/WebM, se elimina el límite no sustentado de 10 s y se define oversize preservado/derivado.
7. **MEDIUM — OAuth sin destino: atendido.** Se incorpora `SSM_GOOGLE_CALENDAR_OAUTH` con schema cerrado y destino existente `/indomito/{stage}/google/calendar-oauth`; el importador lo escribe junto a Meeting o aborta el lote sin writes.
8. **MEDIUM — permisos frontend por acción: atendido.** Se definen `canPerform`, directiva estructural, parent COM:r y matriz c/r/u/d para cada control, con no renderizado y tests por allowance.
9. **MEDIUM — dirección AsyncAPI ambigua: atendido.** Server wss parametriza `apiId`/`stage enum dev|prd`, canal relativo y query ticket; C0 resuelve y compara URLs finales con outputs CloudFormation.
10. **MEDIUM — checkout contractual no trazable: atendido.** Se fija `IND_HUB_API_READ_TOKEN` read-only, repo/path/ref y manifest `servicesCommit`; sync actualiza artefactos+manifest y check exige el SHA exacto.
11. **MEDIUM — despliegue authorizer sin compatibilidad: atendido.** Se agrega fixture contractual del payload real, negativos criptográficos, versión/alias, smoke DEV válido+alterado, observación de Deny y rollback de alias sin restaurar fallback unsigned.
12. **MEDIUM — crecimiento sobre 20.000: atendido.** `CONV_COUNT` transaccional, holgura y alarmas 80/90/100 %; inbound N+1 siempre se persiste. Sobre capacidad lista/bulk devuelven 503 recuperable con alarma, sin parcial, Scan, archivo automático ni pérdida.

No se posterga ni ignora ningún hallazgo HIGH o MEDIUM del gate vigente; los doce quedan incorporados como decisiones vinculantes y verificables.
