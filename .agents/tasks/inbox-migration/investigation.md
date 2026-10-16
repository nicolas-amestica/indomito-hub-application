# Investigación de migración del módulo Inbox

Fecha de inspección: 2026-10-13

## 1. Alcance y nivel de certeza

Este documento registra únicamente investigación estática. No se modificó código productivo ni repositorios legacy y no se copiaron valores secretos.

Repositorios inspeccionados:

- Frontend legacy: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/portal_admin_ng_dev_pri_usw2`
- Backend legacy: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/portal-admin-sls-dev-pri-usw2`
- Frontend destino: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/ind-hub-app-ngx-pri-gh`
- Backend destino: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/ind-hub-api-gox-sls-pri-gh`
- Authorizer destino: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/ind-hub-iam-tsx-sls-pri-gh`
- Infraestructura destino: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/ind-hub-inf-aws-sls-pri-gh`
- Estándares: `/Users/nicoamestica/Documents/Desarrollo/giras-indomito/ind-hub-orc-aws-sls-pri-gh/docs/standards`

La evidencia se clasifica así:

- **Confirmado por código**: comportamiento verificable mediante inspección estática.
- **Pendiente operativo**: requiere sesión AWS, credenciales Meta, navegador o despliegue.
- **Conflicto de migración**: el clon literal contradice un estándar vigente o una capacidad real del destino y debe resolverse en diseño sin perder el comportamiento observable solicitado.

Se intentó confirmar en DynamoDB DEV el perfil `ADMIN`, un posible perfil `ADM` y el módulo padre `ADM`, pero AWS CLI respondió que la sesión SSO expiró y no pudo renovarse. Por tanto, la estructura desplegada actual queda como **pendiente operativo**; la estructura documentada abajo sí está confirmada por código, scripts y tests.

## 2. Inventario completo del Inbox frontend legacy

Directorio raíz:

`/Users/nicoamestica/Documents/Desarrollo/giras-indomito/portal_admin_ng_dev_pri_usw2/src/app/app-admin-portal/inbox`

Archivos rastreados:

```text
README.md
inbox.routes.ts
interfaces/inbox.interface.ts
services/inbox.service.ts
services/inbox-ws.service.ts
stores/inbox.store.ts
stores/fn-actualizar-contacto.ts
stores/fn-actualizar-en-lista.ts
stores/fn-append-mensaje.ts
stores/fn-asegurar-en-lista.ts
stores/fn-buscar-conversaciones.ts
stores/fn-eliminar-conversacion.ts
stores/fn-eliminar-en-lista.ts
stores/fn-fetch-conversation-detail.ts
stores/fn-fetch-conversations.ts
stores/fn-fetch-mensajes-anteriores.ts
stores/fn-fetch-more-conversations.ts
stores/fn-marcar-no-leido.ts
stores/fn-marcar-todos-leidos.ts
stores/fn-send-attachment.ts
stores/fn-send-reply.ts
components/conversation-list/conversation-list.component.{ts,html}
components/conversation-list-item/conversation-list-item.component.{ts,html}
components/chat-message-list/chat-message-list.component.{ts,html}
components/message-bubble/message-bubble.component.{ts,html}
components/message-status-ticks/message-status-ticks.component.{ts,html}
components/chat-date-separator/chat-date-separator.component.{ts,html}
helpers/fn-build-chat-rows.ts
helpers/fn-chat-date-label.ts
helpers/fn-delivery-status-rank.ts
helpers/fn-detalle-cache.ts
helpers/fn-message-track-key.ts
helpers/fn-normalize-conversacion-view.ts
helpers/fn-show-humano-pending-tag.ts
helpers/fn-sort-conversaciones.ts
helpers/fn-whatsapp-service-window.ts
pipes/chat-date.pipe.ts
types/chat-row.interface.ts
```

No hay archivos `*.spec.ts` dentro del módulo Inbox legacy. El comportamiento no está cubierto por tests específicos del módulo en el árbol inspeccionado.

### 2.1 Rutas y permisos legacy

- Ruta canónica IAM/UI: `comunicaciones/conversaciones`, definida como `ROUTE_KEYS.inboxConversations` en `src/app/shared/permissions/route-keys.const.ts`.
- Montaje: `src/app/app-admin-portal/admin-portal.routes.ts` crea la sección `comunicaciones` y carga `inbox.routes.ts`.
- Vista raíz: `InboxShellPage` en `/app/comunicaciones/conversaciones`.
- Detalle hijo: `InboxDetailPage` en `/app/comunicaciones/conversaciones/:phone`.
- Título del detalle: `GI | Detalle de Conversación`.
- `layoutMobilePadding: 'none'` se aplica a shell y detalle.
- `inheritsToChildren: true` hace que el permiso de la ruta padre cubra `:phone`.
- El acceso se resuelve con `buildAdminRoute` + `accessGuard`. Las acciones adjuntar, enviar y grabar audio se muestran solo con permiso `CREATE` sobre `comunicaciones/conversaciones` mediante `*appHasPermission`.
- El administrador legacy tiene bypass frontend, pero la seguridad efectiva de HTTP depende del authorizer.
- El backend legacy traduce este path IAM a los prefijos `/v1/inbox`, `/v1/inbox/adjuntos` y `/v1/extracciones/object` en `libs/fn-build-jwt-endpoints-from-access.js`.

### 2.2 Composición visual y responsive

La UI imita WhatsApp Web con colores hexadecimales específicos, no el diseño corporativo actual de Hub.

#### Escritorio (`md` o mayor)

- Contenedor de altura completa, sin scroll exterior, fondo gris claro/oscuro tipo WhatsApp.
- Panel izquierdo fijo de `w-90`, borde derecho y fondo blanco/negro.
- Panel derecho flexible con placeholder o conversación.
- Panel izquierdo:
  1. Header verde `#008069` en claro y `#202c33` en oscuro.
  2. Avatar circular con icono Inbox.
  3. Texto `WhatsApp Cloud`.
  4. Acciones redondas: `Marcar todo como leído` y `Recargar conversaciones`.
  5. Buscador y botón de filtro leído/no leído.
  6. Etiqueta pequeña de conteo.
  7. Lista virtual de conversaciones.
- Panel derecho sin selección:
  - Avatar grande de comentarios.
  - Título `Todas las conversaciones`.
  - Explicación de selección.
  - Pie con candado y texto `Mensajes protegidos en tiempo real vía WebSocket`.
- Panel derecho con selección:
  - Header verde/oscuro con volver (solo móvil), avatar, alias, teléfono/canal, abrir WhatsApp personal y recargar.
  - Barra de progreso indeterminada de 3 px.
  - Historial.
  - Composer de respuesta.

#### Móvil (menos de `md`)

- Lista y detalle ocupan todo el ancho y se alternan según exista `selectedId`.
- En detalle aparece botón volver.
- No se observó un ancho mínimo probado en código; el diseño usa `min-w-0`, truncados y contenedores flexibles para prevenir overflow.
- La equivalencia a 320 px, 390 px, tablet, iOS y Android debe validarse visualmente; no puede probarse por inspección estática.

### 2.3 Lista, búsqueda, filtros y paginación

- Primera carga: 200 conversaciones.
- TTL cliente de lista: 2 minutos; si sigue vigente no repite fetch salvo `force: true`.
- Recarga forzada:
  - botón de refresh;
  - al volver la pestaña a estado visible;
  - tras reconexión WebSocket;
  - al recibir una actualización para una conversación que aún no está paginada.
- Búsqueda remota por alias o teléfono:
  - placeholder `Buscar conversación...`;
  - debounce de 300 ms;
  - parámetro `q` recortado;
  - límite 200;
  - término vacío restaura listado normal.
- Filtro local alternable: `all` o `unread` (`unreadCount > 0`).
- Conteo contextual:
  - `Mostrando X de Y`;
  - `X de Y coincidencias`;
  - variantes de no leídas;
  - `Sin conversaciones no leídas`.
- Lista virtual CDK:
  - alto estimado por fila: 76 px;
  - carga más elementos al quedar a menos de 160 px del final;
  - página adicional de 20;
  - cursor opaco;
  - evita duplicados por `id`;
  - ordena siempre por `lastMessageAt`, con fallback `updatedAt`, descendente.
- Si se abre una URL directa cuyo teléfono no está cargado, `asegurarEnLista` obtiene el detalle y agrega la conversación ordenada al panel.

#### Estados de la lista

- Cargando sin datos: cinco filas skeleton con avatar y dos líneas animadas.
- Vacío: icono Inbox, `Sin conversaciones` y `Los chats entrantes aparecerán aquí en tiempo real`.
- Cargando página adicional: spinner y `Cargando más…`.
- Error de primera carga: toast y lista vacía. No hay bloque de error persistente ni botón de reintento específico; queda el botón global de recarga.
- Error al cargar más: se ignora visualmente y se libera el estado de carga.

### 2.4 Fila de conversación

- Botón de ancho completo, accesible por Enter/Espacio y con `aria-selected`.
- Avatar de iniciales: primeras letras de hasta dos palabras; `?` si no hay nombre.
- Alias, hora/fecha, preview del último mensaje y badge verde de no leídos.
- Badge limita la visualización a `99+`.
- Hora:
  - hoy: `HH:mm`;
  - ayer: `ayer`;
  - menos de siete días: weekday corto `es-CL`;
  - anterior: `dd/mm/aa`.
- Tag ámbar `Humano` únicamente cuando `status === 'derived'` y `unreadCount > 0`.
- Seleccionada: fondo gris tipo WhatsApp; no seleccionada: hover en claro/oscuro.
- Menú chevron siempre visible en móvil y expandible en hover desde `sm`.

### 2.5 Menú contextual y diálogos

Menú de conversación (`p-popover`):

1. `Editar alias`.
2. `Marcar como no leído`.
3. `Eliminar chat` en rojo.

Diálogo de alias (`p-dialog`):

- ancho 20 rem, modal, no arrastrable ni redimensionable;
- campo `Nombre o alias del contacto` precargado;
- Enter confirma y Escape cierra;
- nombre vacío o sin cambios no envía petición;
- botones `Cancelar` y `Aceptar`.

Confirmación de eliminación:

- header `Eliminar conversación`;
- muestra alias y teléfono cuando difieren;
- advierte que elimina historial DynamoDB y quita el chat de la bandeja;
- botones `Sí, eliminar` y `Cancelar`.

Confirmación de marcar todo leído:

- componente compartido `WarnConfirmDialogComponent`;
- título `Marcar todo como leído`;
- explica que desaparecerán los badges;
- botones `Sí, marcar todas` y `Cancelar`.

### 2.6 Historial de mensajes

- Carga inicial: 50 mensajes más recientes.
- Paginación hacia atrás: cursor igual al `msgSk` más antiguo, carga 50 anteriores y los prepende.
- Scroll:
  - hasta 80 filas usa scroll nativo, con contenido pegado abajo;
  - más de 80 filas usa CDK virtual scroll con alto estimado de 96 px;
  - al quedar a menos de 160 px del inicio carga mensajes anteriores;
  - preserva anclaje después del prepend;
  - considera “cerca del fondo” una distancia menor de 80 px.
- Mensajes nuevos:
  - si el usuario está cerca del fondo, desplaza automáticamente;
  - si no, incrementa un contador y muestra botón flotante `N nuevo(s)`.
- Separadores de fecha:
  - `Hoy`, `Ayer`, weekday largo o fecha larga `es-CL`;
  - se insertan al cambiar el día.
- Formato horario de burbuja:
  - hoy `HH:mm`;
  - ayer `Ayer HH:mm`;
  - anterior `dd/MM/yyyy HH:mm`.
- Vacío: `Sin mensajes registrados`.
- Error/no detalle: `No se pudo cargar la conversación` + `Intenta recargar`.
- Cargando anteriores: pill `Cargando anteriores…`.

#### Tipos de burbuja

- `cliente`: izquierda, avatar usuario, fondo blanco/oscuro.
- `agente_ia`: derecha, avatar sparkle azul, fondo verde WhatsApp.
- `equipo`: derecha, avatar equipo, fondo verde; opacidad reducida mientras `pending`.
- Máximo visual: 75% del ancho.
- Conserva saltos de línea y parte palabras largas.
- Adjuntos:
  - audio: reproductor nativo;
  - URL disponible: enlace en pestaña nueva con `rel="noopener"` e icono de descarga;
  - sin URL: chip informativo no descargable;
  - distingue imagen, audio y documento/PDF por MIME.

#### Estados de entrega

- `sent` o sin estado: un check gris.
- `delivered`: doble check gris.
- `read`: doble check azul.
- `failed`: exclamación roja con tooltip de causa del proveedor o mensaje genérico.
- La progresión es monótona `sent → delivered → read`; `failed` no se reemplaza.
- Si un evento no encuentra `whatsappMessageId`, existe fallback al último mensaje saliente pendiente, excepto para `failed`.

### 2.7 Composer, formularios y validaciones

Formulario reactivo con un único control `content` no nullable.

- Se puede enviar si hay texto no vacío o al menos un adjunto.
- Texto solo: crea burbuja optimista `equipo`, `pending: true`, estado `sent` y `clientMsgId` generado con `crypto.randomUUID()`.
- El backend confirma `createdAt`, `msgSk` y `whatsappMessageId`; el store reconcilia la burbuja.
- Error HTTP distinto de status 0: retira la burbuja optimista y muestra toast.
- Status 0: se ignora en este helper, presumiblemente para evitar duplicar manejo de desconexión.
- Adjuntos:
  1. obtiene URL prefirmada;
  2. PUT binario directo a S3 con `fetch`, sin `Authorization`;
  3. notifica al backend;
  4. procesa varios archivos concurrentemente;
  5. solo el primer archivo recibe el caption.
- Selector de archivos:
  - atributo HTML: `.pdf,image/*` y `multiple`;
  - validación real: `application/pdf`, JPEG, PNG, GIF y WebP;
  - máximo 7 MiB por archivo;
  - si uno es inválido, rechaza el lote completo;
  - muestra chips removibles.
- Grabación:
  - solicita micrófono con `navigator.mediaDevices.getUserMedia({audio:true})`;
  - prefiere OGG/Opus, luego WebM/Opus y finalmente WebM;
  - detener agrega el audio a seleccionados;
  - si se destruye grabando, detiene recorder;
  - error de permisos muestra toast.
- Emoji:
  - popover con 40 emojis en grilla de ocho columnas;
  - inserta en la posición actual del cursor y restaura foco.
- Ventana de servicio WhatsApp:
  - usa el último mensaje visible de tipo `cliente`;
  - cerrada si no existe, está en el futuro o han pasado 24 horas;
  - muestra advertencia ámbar y bloquea envío con toast;
  - el backend vuelve a validar esta regla.
- `Agente procesando mensaje…` aparece con icono animado según WebSocket.
- Botón final alterna enviar y micrófono; las acciones de creación dependen de permiso `CREATE`.
- Abrir WhatsApp personal usa `https://wa.me/<solo-dígitos>` en nueva ventana.

### 2.8 Estado y caché

`InboxStore` legacy es un Signal Store global (`providedIn: root`) con:

- flags: lista, detalle, responder, adjuntar y cargar más;
- lista, total, total no leído, cursor y búsqueda;
- conversación actual;
- filtro;
- paginación de mensajes;
- estado del agente;
- caché LRU por teléfono de hasta cinco detalles;
- contador de mensajes prepended.

Comportamiento relevante:

- Cambiar de conversación guarda el detalle actual en caché.
- Volver a una conversación puede restaurar caché y luego pedir delta.
- Un refresh normal con conversación cargada usa `since=<timestamp del último mensaje>`; “recargar historial” fuerza carga completa.
- La conciliación de mensajes usa, en orden, `msgSk`, `whatsappMessageId`, coincidencia de saliente sin ID y finalmente `timestamp|tipo|contenido`.
- Abrir un chat resetea localmente su badge y el backend marca leído en segundo plano.
- Responder o adjuntar limpia `unreadCount`.

### 2.9 Eventos WebSocket consumidos

Dos conexiones simultáneas:

- Lista: `?scope=list`.
- Detalle: `?phone=<phone>`.

El servicio base agrega el JWT como query param `token`, reconecta con backoff exponencial desde 1 segundo hasta 30 segundos y emite evento sintético `reconnected`.

Eventos:

| Evento | Canal | Efecto frontend |
| --- | --- | --- |
| `new_message` | lista/detalle | refresca detalle o lista si el chat no está cargado |
| `conversation_updated` | lista | patch de badge, preview, fecha, estado y motivo; reordena |
| `contact_updated` | lista | actualiza alias |
| `conversation_deleted` | lista | quita chat |
| `message_appended` | lista/detalle | agrega/reconcilia burbuja y preview |
| `message_delivered` | detalle | progresa estado de entrega |
| `agent_processing` | detalle | muestra/oculta indicador |
| `all_conversations_read` | lista | limpia todos los badges |
| `reconnected` | ambos | fuerza sincronización HTTP |

**Conflicto de seguridad:** incluir JWT en la URL WebSocket puede exponerlo en logs, historial o infraestructura. El destino prohíbe registrar tokens y centraliza auth en el authorizer. La migración debe conservar reconexión y permisos, pero no copiar este transporte de token sin una decisión segura (por ejemplo, autorización de `$connect` compatible con navegador o ticket efímero). Este punto no puede resolverse copiando literalmente `PortalWsService`.

## 3. Backend legacy que sirve Inbox

Servicio:

`/Users/nicoamestica/Documents/Desarrollo/giras-indomito/portal-admin-sls-dev-pri-usw2/services/api-whatsapp-agent`

Stack Serverless: `agente-whatsapp`, Node.js 20 ARM64, región legacy `us-west-2`, un HTTP API compartido y un WebSocket API propio.

### 3.1 Endpoints administrativos exactos

Todos los endpoints Inbox HTTP tienen authorizer request legacy, salvo webhook de Meta. El envelope exitoso es `{state:true, metadata:{...}, data:<payload>}`. El error es `{state:false, metadata:{action,statusCode}, data:{message,code,correlationId,...}}`; varios errores legacy no asignan `code`, lo cual no cumple el contrato destino.

#### GET `/v1/inbox/conversaciones`

- Query params:
  - `limit`: entero, default 200, mínimo 1, máximo 250;
  - `cursor`: base64url opaco con `{lastMessageAt,id}`;
  - `q`: búsqueda case-insensitive por substring de alias o teléfono.
- Respuesta `data`:
  - `items: ConversacionView[]`;
  - `hasMore: boolean`;
  - `nextCursor: string|null`;
  - `total: number`;
  - `unreadTotal: number`.
- Persistencia: `Query` iterativa de `pk=CHATS`, luego orden, filtro y paginación en memoria.
- Éxito 200; error 500 o `error.statusCode`.
- No usa `Scan`, pero lee toda la partición para cada búsqueda/página.

#### GET `/v1/inbox/conversaciones/{phone}`

- Path param `phone` obligatorio; normaliza quitando `+`.
- Query params mutuamente semánticos:
  - `since=<ISO>`: mensajes posteriores al timestamp, orden ascendente, sin paginación;
  - `cursor=<msgSk>`: 50 mensajes anteriores;
  - ninguno: últimos 50 y marcado leído asíncrono.
- Respuesta 200 `ConversacionDetalle` con metadatos, `mensajes`, `hasMore`, `nextCursor`.
- `phone` faltante: 400.
- La carga completa retorna el unread previo, mientras frontend lo pone en cero localmente.
- Un teléfono sin ítem existente no retorna 404: arma un detalle vacío con fallbacks.

#### POST `/v1/inbox/conversaciones/{phone}/responder`

- Body: `{content:string}`; recorta extremos y exige no vacío.
- Valida ventana WhatsApp de 24 horas.
- Envía por WhatsApp Cloud API, registra índice WAMID, persiste mensaje `team`, actualiza lista, marca leído y emite eventos.
- Respuesta 200: `{whatsappMessageId:string|null,msgSk:string,createdAt:string}`.
- Errores:
  - 400 `phone es requerido`;
  - 400 `content es requerido`;
  - 422 `WHATSAPP_SERVICE_WINDOW_CLOSED` con `lastUserMessageAt`;
  - fallas Meta/SSM/DynamoDB: status heredado o 500.

#### POST `/v1/inbox/adjuntos/presign`

- Body: `{fileName:string,mimeType:string}`.
- Sanitiza basename a `[a-zA-Z0-9._-]`, máximo 200 caracteres; rechaza traversal.
- Key temporal: prefijo `inbox-adjuntos/`, identificador UUIDv7 legacy y nombre seguro.
- URL PUT expira en 300 segundos.
- Respuesta 200: `{uploadUrl,s3Key}`.
- Error 400 por campos faltantes o nombre inválido.

#### POST `/v1/inbox/conversaciones/{phone}/adjuntar`

- Body: `{s3Key,fileName,mimeType,caption?}`.
- Exige key bajo `inbox-adjuntos/`, sin `..`.
- Valida ventana de 24 horas.
- Descarga de S3, verifica máximo 7 MiB, convierte audio si corresponde, sube a Media API y envía imagen/audio/documento.
- Persiste mensaje `team`, actualiza preview, marca leído, emite eventos y elimina objeto temporal de S3 en segundo plano.
- Respuesta 200: `{whatsappMessageId,msgSk,createdAt}`.
- Errores:
  - 400 campos faltantes;
  - 403 key no permitida;
  - 400 archivo sobre 7 MiB;
  - 422 ventana cerrada;
  - fallas externas o internas: status heredado o 500.
- La persistencia después de enviar se trata como “no crítica”: puede responder éxito aunque falle write-through. Esto debe conservarse conscientemente o corregirse con idempotencia/outbox; hoy es una posible inconsistencia observable.

#### DELETE `/v1/inbox/conversaciones/{phone}`

- Elimina mensajes/sesión `CONV#phone`, conexiones `WS#phone`, lookup `WSCONN#`, fila `CHATS` e ítem legacy `INBOX`.
- Emite `conversation_deleted` a lista.
- Respuesta 200 `{phone}`.
- Error 400 por teléfono faltante; 500 u heredado.
- No devuelve 404 si la conversación ya no existe; es efectivamente idempotente.

#### PATCH `/v1/inbox/conversaciones/{phone}/contacto`

- Body `{name:string}` no vacío.
- Actualiza alias en fila `CHATS` y sesión `CONV#`; cada write atrapa error de forma independiente.
- Emite `contact_updated` incluso si ambas escrituras fallan.
- Respuesta 200 `{phone,name}`.
- Error 400 por campos faltantes.

#### PATCH `/v1/inbox/conversaciones/{phone}/marcar-no-leido`

- Fija `unreadCount=1` en `CHATS` y sesión.
- Emite `conversation_updated`.
- Respuesta 200 `{phone}`.
- Error 400 por teléfono faltante.
- Las dos escrituras atrapan fallos por separado, por lo que puede responder éxito sin persistencia completa.

#### PATCH `/v1/inbox/conversaciones/marcar-todos-leidos`

- Consulta `pk=CHATS`, filtra no leídos y procesa en chunks de 25.
- Fija en cero fila y sesión; errores individuales solo se registran.
- Emite `all_conversations_read`.
- Respuesta 200 `{updated:number}`; `updated` cuenta chats procesados, no escrituras confirmadas.

#### PATCH `/v1/inbox/conversaciones/recalcular-unread`

- Endpoint administrativo de mantenimiento, no invocado desde una vista actual.
- Para cada chat, consulta el último mensaje `MSG#`:
  - `model` o `team`: limpia unread;
  - `user`: mantiene unread;
  - sin mensaje y con unread: limpia.
- Chunks de 25.
- Respuesta 200 `{cleared,keptUnread,unchanged}`.
- Si limpió alguno, emite globalmente `all_conversations_read`; este evento puede limpiar badges de conversaciones que el proceso dejó no leídas, una inconsistencia potencial del legacy.

### 3.2 Webhooks y WebSocket

#### GET `/v1/whatsapp/webhook`

Público para handshake Meta. Exige `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`; compara en tiempo constante con el campo `verify_token` del SecureString WhatsApp. Respuestas: 200 challenge, 400 parámetros, 403 token distinto, 500 fallo interno.

#### POST `/v1/whatsapp/webhook`

Público por necesidad de proveedor, pero valida `X-Hub-Signature-256` HMAC-SHA256 contra `app_secret`. Siempre responde 200 `{status:'ok'}` incluso con firma inválida o payload irrelevante para impedir reintentos/abuso; procesa estados salientes o invoca asíncronamente al agente.

#### `$connect`

- Exige `token` en query.
- Verifica JWT con secreto legacy.
- `scope=list` exige un endpoint token que contenga `/v1/inbox`.
- `phone` también exige `/v1/inbox`.
- Registra conexión y lookup inverso con TTL 24 horas.
- Respuestas: 200, 400 sin scope/phone, 401 token inválido, 403 sin endpoint, 500.

#### `$disconnect`

Resuelve por `WSCONN#connectionId` y elimina lookup y conexión fuente. Responde 200 o 500.

### 3.3 Flujo entrante y agente que alimentan Inbox

Para clonar lógica y comportamiento no basta implementar los endpoints administrativos: Inbox recibe datos generados por webhook/agente.

- El webhook acepta texto y audio WhatsApp; Messenger/Instagram están detrás de `ENABLE_META_CHANNELS`.
- Todo mensaje entrante válido se persiste antes de ejecutar IA.
- Idempotencia por `messageId` de Meta con TTL de siete días.
- Historial y filas de lista expiran a 90 días.
- Cada entrante incrementa `unreadCount`, actualiza preview y emite `message_appended` + `conversation_updated`.
- Debounce del agente agrupa bursts.
- Límite: cinco mensajes por teléfono en 60 segundos; los excedidos se guardan, pero no reciben respuesta automática.
- Mensaje al agente se trunca a 800 caracteres.
- Mientras procesa, emite `agent_processing` activo/inactivo.
- Si Gemini falla, no encuentra presupuesto o decide `sin_respuesta`, la conversación pasa a `status=derived`, unread=1 y motivo etiquetado; no se envía respuesta al cliente.
- Si el agente responde correctamente, guarda turno `model`, envía estado, marca conversación leída y desaparece el tag Humano por unread=0.
- Estados Meta `delivered`, `read` y `failed` se correlacionan mediante `WAMID#` y se transmiten al chat.

### 3.4 Modelo DynamoDB legacy

Tabla única `CONVERSATIONS_TABLE`, PK/SK, PAY_PER_REQUEST y TTL `ttl`.

Patrones observados:

| PK | SK | Uso |
| --- | --- | --- |
| `CHATS` | `CONV#<phone>` | fila de lista global |
| `CONV#<phone>` | `CONV#<phone>` | sesión/metadatos |
| `CONV#<phone>` | `MSG#<uuidv7>` | mensajes cronológicos |
| `META_MSG#<messageId>` | `META` | idempotencia entrante |
| `WAMID#<wamid>` | `META` | correlación de delivery saliente |
| `WS#LIST` | `CONN#<connectionId>` | suscripción global |
| `WS#<phone>` | `CONN#<connectionId>` | suscripción a detalle |
| `WSCONN#<connectionId>` | igual | lookup inverso |
| `RATE#<phone>` | igual | rate limit |
| `INBOX` | `CONV#<phone>` | compatibilidad legacy de derivaciones |

No hay `Scan` en el código Inbox inspeccionado; se usan `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem` y `Query`.

## 4. Configuración y variables legacy

### 4.1 Frontend legacy

| Nombre exacto | Propósito | Archivo exacto | Obtención segura |
| --- | --- | --- | --- |
| `environment.baseApi` | Base HTTP del API legacy | `portal_admin_ng_dev_pri_usw2/src/environments/environment.ts`, `.staging.ts`, `.production.ts` | Leer el archivo correspondiente; para confirmar despliegue DEV consultar el export CloudFormation `portal-admin-dev-api-url` sin `--with-decryption` |
| `environment.wsEndpoint` | Base WSS del Inbox | mismos archivos | Obtener el API ID del export `inbox-ws-dev-id` y construir `wss://<id>.execute-api.us-west-2.amazonaws.com/dev`; no es secreto |
| `environment.whatsappUri` | Base de enlace personal | mismos archivos | Leer configuración versionada; no es secreto |

`version`, `stage`, `googleClientId` e `infoAssetsPublicBaseUrl` existen en esos ambientes, pero Inbox no los consume directamente.

### 4.2 Backend legacy: configuración de infraestructura

Definidas en `services/api-whatsapp-agent/serverless.yml`:

| Nombre exacto | Propósito | Origen legacy | Tratamiento destino |
| --- | --- | --- | --- |
| `STAGE` | ambiente | Serverless | configuración estándar `APP_STAGE` |
| `PROFILE` | perfil deploy legacy | Serverless | no pasar como runtime en destino |
| `NODE_OPTIONS` | source maps Node | literal | no aplica a Go |
| `TIMEZONE` | zona Chile | literal | si se requiere, configuración no secreta; preferir manejo explícito de zona |
| `WHATSAPP_SECRET_KEY` | path al JSON WhatsApp | `/pa/{stage}/whatsapp-config` | migrar contenido a SecureString bajo `/indomito/{stage}/inbox/...` |
| `GEMINI_SECRET_KEY` | path a API key Gemini | `/pa/{stage}/gemini-api-key` | solo si se migra también el agente; SecureString |
| `GOOGLE_CALENDAR_OAUTH_SECRET_KEY` | OAuth calendario | `/pa/{stage}/google-calendar-oauth` | solo si se migra agenda del agente; ya existe familia Google en destino, no duplicar sin revisar ownership |
| `GOOGLE_CALENDAR_ID` | calendario compartido | literal legacy | configuración runtime; no hardcodear en el servicio nuevo |
| `CONVERSATIONS_TABLE` | tabla única Inbox | nombre generado | output CloudFormation de nueva tabla destino |
| `BUCKET_INFO_GI` | adjuntos temporales y documentos del agente | nombre generado | reutilizar `MediaBucket` o crear bucket específico según retención/ownership; CORS PUT ya existe en MediaBucket |
| `AGENT_LAMBDA_NAME` | invocación async del agente | nombre generado | output/ref CloudFormation; no hardcodear |
| `META_PAGE_SECRET_KEY` | credenciales Messenger/Instagram | `/pa/{stage}/meta-page-config` | solo si canales se habilitan; SecureString |
| `SECRET_KEY` | JWT legacy para `$connect` | `/pa/{stage}/jwt-key` | **no migrar/reusar**; destino usa authorizer central y secreto auth propio |
| `ENABLE_META_CHANNELS` | habilita Messenger/Instagram | literal `false` | configuración runtime; conservar apagado hasta decisión explícita |
| `AGENT_DEBOUNCE_MS` | agrupación de bursts | literal | configuración runtime |
| `WS_MANAGEMENT_ENDPOINT` | publicar a conexiones | `Fn::Join` del WebSocket API | output/ref del stack WSS destino |
| `MEET_DEFAULT_GUEST_EMAILS` | asistentes por defecto del agente | literal legacy | dato de negocio/PII; mover a configuración dinámica o SecureString, no copiar literal |
| `MEET_DEFAULT_HOST_SK` | anfitrión por defecto | literal legacy | configuración dinámica, no copiar UUID legacy |
| `MEET_DEFAULT_HOST_NAME` | nombre anfitrión | literal legacy | configuración dinámica, no copiar literal |
| `AWS_REGION` | SDK/invocación async | inyectada por Lambda | automática |
| `GEMINI_API_KEY_EVAL` | override local de evaluación | helper Gemini | solo local, nunca commitear |

Estructuras esperadas, sin valores:

- WhatsApp JSON: `access_token`, `phone_number_id`, `verify_token`, `app_secret`.
- Gemini JSON: `api_key`.
- Google OAuth JSON: `client_id`, `client_secret`, `refresh_token`.
- Meta Page JSON: `page_access_token`, `app_secret`.

### 4.3 Comandos seguros para obtener/migrar valores legacy

Primero confirmar metadata sin revelar el valor:

```bash
aws ssm get-parameter \
  --name '/pa/dev/whatsapp-config' \
  --profile pa-dev \
  --region us-west-2 \
  --query 'Parameter.{Name:Name,Type:Type,Version:Version,LastModifiedDate:LastModifiedDate}' \
  --output json \
  --no-cli-pager
```

Repetir cambiando únicamente `--name` por:

- `/pa/dev/gemini-api-key`
- `/pa/dev/google-calendar-oauth`
- `/pa/dev/meta-page-config`
- `/pa/dev/jwt-key` (solo auditar existencia; no migrarlo para Inbox)

Para transferir un secreto entre regiones sin imprimirlo ni incluirlo como argumento literal en historial, usar sesión con tracing desactivado y limpiar la variable inmediatamente:

```bash
set +x
legacy_value="$(aws ssm get-parameter \
  --name '/pa/dev/whatsapp-config' \
  --with-decryption \
  --profile pa-dev \
  --region us-west-2 \
  --query 'Parameter.Value' \
  --output text \
  --no-cli-pager)"
aws ssm put-parameter \
  --name '/indomito/dev/inbox/whatsapp-config' \
  --value "$legacy_value" \
  --type SecureString \
  --overwrite \
  --profile pa-dev \
  --region us-east-1 \
  --no-cli-pager >/dev/null
unset legacy_value
```

Antes de ejecutar una copia real se debe confirmar que `pa-dev` puede acceder a ambas cuentas/regiones y que se reutilizará la misma cuenta/phone number de Meta. No ejecutar en paralelo legacy y destino sobre el mismo webhook: Meta debe apuntar a un único procesador durante el corte para evitar respuestas duplicadas.

Para auditar recursos no secretos:

```bash
aws cloudformation list-exports --profile pa-dev --region us-west-2 \
  --query "Exports[?Name=='portal-admin-dev-api-url' || Name=='inbox-ws-dev-id'].[Name,Value]" \
  --output table --no-cli-pager

aws dynamodb describe-table --table-name 'conversations-dev-pri-usw2' \
  --profile pa-dev --region us-west-2 \
  --query 'Table.{Name:TableName,Status:TableStatus,Keys:KeySchema,TTL:LatestStreamLabel}' \
  --output json --no-cli-pager
```

No copiar la salida de comandos con `--with-decryption` a este documento, tickets, chats ni logs.

## 5. Arquitectura destino inspeccionada

### 5.1 Frontend moderno

Referencia: `ind-hub-app-ngx-pri-gh/src/app/indomito-hub/programs`.

Patrones confirmados:

- Feature autocontenida con `components`, `constants`, `fn`, `interfaces`, `pages`, `services`, `stores`, `types`, rutas y tests junto al código.
- Standalone components, `OnPush`, `inject()`, signals y stores `@Injectable` feature-scoped.
- Páginas container orquestan; componentes presentacionales no hacen IO.
- Servicios HTTP solo mapean envelopes `{data}`.
- Rutas lazy con `loadChildren`/`loadComponent`.
- Vitest vía `npm test`; build `npm run build` o `npm run build:dev`.
- PrimeNG v22 + Tailwind 4.3.

Ubicación destino correcta para esta feature:

`src/app/indomito-hub/inbox/`

Estructura esperable por el patrón local:

```text
inbox/
├── constants/
├── components/
├── interfaces/
├── pages/
├── services/
├── stores/
├── types/
├── fn/
└── inbox.routes.ts
```

Dependencias/gaps en app-ngx-hub:

- No existe módulo Inbox ni cliente WebSocket.
- `environment.dev.ts` contiene `apiUrl` pero no `wsUrl` ni `whatsappUri`.
- Hay `NotificationService` y un interceptor central de errores por `code`; no debe copiarse la lectura de `message` crudo del backend legacy.
- IAM expone módulos y allowances, pero `moduleGuard` solo valida código de módulo; no existe una directiva equivalente a `appHasPermission` para ocultar acciones CRUD. Para paridad, debe añadirse un mecanismo action-level basado en `AuthPermission.allowances`, o las acciones se verán aunque el authorizer las rechace.
- `AuthService` conserva sesión en `sessionStorage`; el estándar de seguridad indica access token en memoria. Esta inconsistencia preexistente no debe ampliarse usando query strings WebSocket.
- `app.routes.ts` deberá registrar la ruta lazy y `data.module` del código IAM decidido.
- El menú muestra solo módulos LV2; los LV1 habilitan jerarquía/permisos, pero no se renderizan como tarjetas.

**Conflicto UI:** el legacy usa numerosos hexadecimales y botones HTML manuales. Los estándares destino exigen tokens semánticos, PrimeNG para controles, bordes `line`, temas claro/oscuro, mobile-first y prohíben copiar controles artesanales cuando PrimeNG ofrece uno. “Exactamente igual” debe interpretarse como equivalencia visual/funcional observable, implementada con tokens/PrimeNG; no como copia textual de clases legacy que violaría el sistema de diseño.

### 5.2 Backend Go moderno

La ruta solicitada como referencia, `services/api-auth`, **no existe** en el checkout actual. `git ls-files 'services/api-auth/**'` no devolvió archivos y el directorio está ausente. La documentación raíz que afirma que `services/` está vacío está desactualizada: actualmente existen `api-catalog`, `api-program`, `api-contract`, `api-identity`, `api-meet`, `api-payment` y `payment-receipts`.

Se inspeccionaron como referencias reales:

- `services/api-catalog`: patrón moderno más claro de endpoint-per-function.
- `services/api-identity`: fuente funcional IAM y auth.
- `common/api-services.ts`, `common/go-service.ts`, `go.work`, `README.md`.

Patrón que debe seguir un futuro servicio Inbox:

- Servicio nuevo bajo `services/api-inbox` (nombre a confirmar en diseño, pero no mezclarlo con `api-identity` ni authorizer).
- Registrar nombre en `common/api-services.ts` y módulo en `go.work`.
- Un `cmd/fn-<endpoint>-v1/main.go` por endpoint.
- Rutas equivalentes en `serverless.ts` y `functions/routes.go`.
- `functions/app.go`, `config.go`, `routes.go`, endpoint packages y dominio/datasources sin `repository/` ni `store/`.
- `service.config.json` declara funciones y `requiredEnvironment`.
- `ctx context.Context` primero para IO, zap estructurado, ULID para nuevos IDs, errores estándar y OpenAPI fragment.
- Endpoints administrativos privados; webhook Meta público pero con firma validada dentro del handler.
- El microservicio no valida JWT. La identidad llega desde `requestContext.authorizer.lambda`.

### 5.3 Persistencia e infraestructura faltante

- `ddb/ddb-config.ts` no registra tabla de conversaciones.
- `s3/s3-config.ts` sí tiene `MediaBucket`, privado, cifrado AES256, CORS para frontend Hub y métodos PUT/POST/GET/HEAD. Puede soportar el flujo prefirmado, pero hay que confirmar ownership, lifecycle de temporales y permisos mínimos antes de reutilizarlo.
- `iot/` es solo placeholder; no implementa WebSocket ni realtime.
- `api-gateway/` crea únicamente HTTP API v2. No existe WebSocket API, rutas `$connect/$disconnect`, management endpoint ni políticas `execute-api:ManageConnections`.
- El authorizer está activo en DEV y desactivado en PRD.
- No existe una forma desplegada para paridad realtime en destino; es trabajo cross-repo obligatorio.
- El listado legacy hace Query de toda la partición y filtra substring en memoria. Esto no viola literalmente la prohibición de `Scan`, pero no es paginación server-side eficiente. Para mantener búsqueda contains exacta sin Scan se necesita documentar un patrón de índice/ítems de búsqueda o aceptar explícitamente Query completa sobre `CHATS`; no se debe improvisar un `Scan`.

## 6. IAM destino: fuente de verdad real

### 6.1 Qué administra cada pieza

- **`ind-hub-iam-tsx-sls-pri-gh`**: solo valida JWT HMAC-SHA256, el método HTTP y los endpoints/allowances incluidos en el token; devuelve Allow/Deny y contexto. No crea perfiles, no crea módulos, no asigna permisos y no persiste IAM funcional.
- **`ind-hub-api-gox-sls-pri-gh/services/api-identity`**: API CRUD de usuarios, perfiles, módulos y permisos; emite JWT con `access` derivado de los módulos/permisos DynamoDB.
- **Tabla `UsuariosTable` de infraestructura**: fuente de verdad persistida de módulos, perfiles y asignaciones.
- **`app-ngx-hub/administration/iam`**: interfaz administrativa que consume `/iam/modulos` y `/iam/perfiles/{codigo}/permisos`; no es fuente de verdad por sí misma.

### 6.2 Claves y contratos DynamoDB destino

Módulo:

- `pk = APP#INDOMITO_HUB`
- LV1: `sk = APP#INDOMITO_HUB#LV1#<code>`
- LV2: `sk = APP#INDOMITO_HUB#LV1#<parentCode>#LV2#<code>`

Permiso de perfil:

- `pk = APP#PROFILE#PERMISSIONS`
- `sk = PFL#<profileCode>#APP#INDOMITO_HUB#LV1#<parent>` y, para hijo, `#LV2#<moduleCode>`.
- Campos: `moduleCode`, `parentCode`, `allowances` (`c`,`r`,`u`,`d`).

Un LV2 solo llega al menú/token si su LV1 tiene allowance `r`. El perfil debe recibir permiso de lectura sobre el padre y permisos CRUD correspondientes sobre el hijo.

### 6.3 Aclaración de `ADM`

La evidencia estática consistente indica:

- Perfil visible **Administrador**: código interno `ADMIN`.
- Módulo padre **Administración**: código `ADM`.

Evidencias:

- `scripts/configure-contract-iam-dev.sh` lo declara explícitamente.
- Scripts de Meet y catálogo escriben permisos con prefijo `PFL#ADMIN#...#LV1#ADM#...`.
- El formulario IAM crea usuarios por defecto con `profileCode: 'ADMIN'`.
- El estándar `auth-flow.md` usa `profileCode: 'ADMIN'`.

Existe una fixture en `app-ngx-hub/src/app/core/auth/auth.service.spec.ts` con `profileCode: 'ADM'`, pero es inconsistente con la fuente funcional y parece dato de prueba heredado. No debe guiar la escritura real.

Por lo tanto, la instrucción “perfil Administrador código ADM” contiene una colisión semántica. Si el objetivo es asignar al perfil Administrador real, la asignación debe usar `PFL#ADMIN`. `ADM` solo debe usarse como padre si se decide ubicar Inbox dentro de Administración.

### 6.4 Dónde registrar Inbox

Fuente persistida final: tabla `UsuariosTable` del stack `indomito-hub-infra-ddb-{stage}`.

Mecanismos soportados:

1. API `POST /iam/modulos` + `PUT /iam/perfiles/ADMIN/permisos` mediante `api-identity`/pantalla IAM.
2. Script idempotente versionado, siguiendo `ind-hub-api-gox-sls-pri-gh/scripts/configure-contract-iam-dev.sh`, en el repo que implementa el contrato backend. Los scripts duplicados de Meet en infraestructura y services muestran deuda; para Inbox debe existir una sola fuente de automatización.

Archivo recomendado para automatización futura: `ind-hub-api-gox-sls-pri-gh/scripts/configure-inbox-iam-dev.sh`, porque los endpoints y su contrato viven en `services`. Debe resolver `UsuariosTableName` por output CloudFormation, registrar módulo(s), asignar a `PFL#ADMIN` y ser idempotente. No se creó en esta investigación.

Decisión de jerarquía pendiente:

- Paridad con legacy sugiere LV1 `COM`/“Comunicaciones” + LV2 `INBOX`/“Conversaciones”, ruta `/comunicaciones/conversaciones` o la ruta destino acordada.
- Colgar `INBOX` de LV1 `ADM` satisface una lectura literal de “ADM”, pero cambia la jerarquía legacy de Comunicaciones.
- La fuente actual no contiene una definición estática versionada del LV1 Comunicaciones destino y AWS no pudo consultarse por SSO expirado.

La implementación debe decidir explícitamente la jerarquía; no debe confundir `ADMIN` con `ADM`. Para preservar UX legacy, la opción coherente es crear/usar un padre de Comunicaciones y asignar padre+hijo a `ADMIN`.

Los `endpoints` del módulo deben coincidir con las rutas **destino reales**, sin copiar automáticamente el prefijo legacy `/v1`, porque los servicios actuales del Hub se exponen en la raíz (`/contratos`, `/catalogos`, `/iam`, etc.). Después de cambiar IAM, el usuario debe cerrar sesión/iniciar sesión o ejecutar refresh de permisos para recibir un JWT nuevo.

## 7. `.env.dev` de infraestructura y SSM

### 7.1 Convención real

- Plantilla versionada: `ind-hub-inf-aws-sls-pri-gh/environments/.env.example`.
- Archivo local: `environments/.env.dev`; existe en la máquina inspeccionada y está ignorado por Git mediante `environments/.env.*`.
- Registro de parámetros: `ssm/ssm-config.ts`.
- Aplicación: `scripts/ssm-apply-securestring.ts`.
- Comando: `make deploy resource=ssm stage=dev`.
- CloudFormation no puede crear `AWS::SSM::Parameter` como SecureString. El script aplica secretos directamente con `aws ssm put-parameter` y no imprime valores.

### 7.2 Conciliación con el pedido literal

`environments/.env.dev` no es configuración runtime ni debe versionarse. Es solo una entrada local transitoria para aprovisionar SSM.

Para Inbox:

- Agregar **placeholders sin valores reales** a `environments/.env.example`.
- Agregar entradas en `ssm/ssm-config.ts` con `type:'SecureString'`, `secureOnly:true` y, cuando proceda, `optional:true`.
- Completar valores reales únicamente en `environments/.env.dev` local/ignorado o migrarlos directamente SSM→SSM.
- Los Lambdas deben recibir el **path** del parámetro o una referencia resuelta por Serverless, nunca secretos hardcodeados.
- Dado el requisito no negociable, todas las variables de runtime del Inbox que se externalicen deben ir por SSM SecureString, incluso si algunas no son credenciales. Outputs CloudFormation siguen siendo apropiados para nombres/ARNs generados de recursos, porque no son variables de negocio ni secretos.

Nombres propuestos para documentar en la plantilla, sujetos al diseño final:

```text
SSM_INBOX_WHATSAPP_CONFIG=COMPLETAR_JSON_WHATSAPP
SSM_INBOX_GEMINI_CONFIG=COMPLETAR_JSON_GEMINI
SSM_INBOX_META_PAGE_CONFIG=COMPLETAR_JSON_META_PAGE
SSM_INBOX_AGENT_CONFIG=COMPLETAR_JSON_DEBOUNCE_LIMITS_CHANNEL_FLAGS
SSM_INBOX_CALENDAR_CONFIG=COMPLETAR_REFERENCIA_CONFIG_CALENDAR
```

No debe agregarse `SSM_INBOX_JWT_SECRET`: Inbox reutiliza el auth central y no posee un secreto JWT propio.

Los nombres/path definitivos recomendados:

- `/indomito/{stage}/inbox/whatsapp-config`
- `/indomito/{stage}/inbox/gemini-config`
- `/indomito/{stage}/inbox/meta-page-config`
- `/indomito/{stage}/inbox/agent-config`

La URL WSS, nombre de tabla, bucket y endpoint management deben provenir de outputs CloudFormation y wiring Serverless; no copiar IDs legacy a `.env.dev`.

## 8. Restricciones de estándares aplicables

### Frontend

- Standalone + `OnPush`, signals, `inject()`.
- `@if`, `@for`, `@switch`; no copiar `*ngIf/*ngFor`. El legacy aún usa `*cdkVirtualFor`, que es una directiva CDK necesaria para virtual scroll y debe verificarse contra Angular 22.
- PrimeNG v22 para controles; Tailwind 4.3 para layout.
- Sin CSS/SCSS de componente ni selectores `.p-*` globales.
- Tokens semánticos y contraste claro/oscuro; no copiar hexadecimales sin mapearlos al preset/tokens.
- Bordes estructurales `border-line/75` claro y `dark:border-line/55` oscuro.
- Validación obligatoria a 320 px, 390 px, tablet y escritorio; teclado y táctil.
- Errores por interceptor/código, nunca mostrar `message` backend crudo.
- Tests Vitest junto al código. La falta de tests legacy obliga a crear caracterización desde la conducta inspeccionada.

### Backend

- Go 1.25, endpoint-per-function, Lambda ARM64 `provided.al2023`.
- `ctx` primero, zap, Godoc en español, errores con `apperr`/`lambdautil`.
- ULID para IDs nuevos; no copiar UUIDv7 del legacy.
- Prohibición absoluta de DynamoDB `Scan`.
- Persistencia directa en `functions/` o `domain/.../datasources`, sin repository/store.
- Tabla/config por entorno, nunca hardcodeadas.
- Endpoint privado por defecto; webhook público con firma del proveedor.
- OpenAPI fragment obligatorio antes de frontend según contracts policy.
- Paginación estándar destino `page/pageSize/pageInfo`; el cursor legacy es un conflicto de contrato. Se puede mantener UX de scroll infinito adaptando el store al contrato moderno, pero la decisión debe quedar en el diseño/contrato.
- Tests sin AWS real y `go test ./...`; además `make build` y `make validate` del servicio.

### Auth y seguridad

- Un único Lambda Authorizer compartido; el servicio Inbox no revalida JWT.
- Token nunca en logs ni evento crudo.
- Secretos y runtime config solo SSM SecureString.
- Región destino `us-east-1`; no reutilizar nombres/ARNs/URLs de `us-west-2`.
- Webhook Meta debe validar firma HMAC y responder rápido.
- La migración del mismo número WhatsApp requiere cutover coordinado para no duplicar procesamiento.

## 9. Comportamientos pendientes de verificación operativa

1. Apariencia pixel a pixel real en navegadores y breakpoints; la inspección solo confirma markup/clases.
2. Permisos de micrófono, MIME final y reproducción OGG/WebM en Safari iOS, Android y escritorio.
3. Precisión del virtual scroll con burbujas de altura variable; el alto fijo 96 px puede producir saltos.
4. Orden y duplicación bajo carreras entre respuesta HTTP, `message_appended` y `message_delivered`.
5. Comportamiento cuando `since` contiene timestamp inválido; el backend forma una sort key con fecha inválida.
6. Semántica real de `fetch` PUT a S3 bajo CORS legacy y destino.
7. Fallos parciales que legacy trata como éxito en alias, marcar no leído, marcar todos y adjuntar.
8. Estado IAM real DEV/PRD y existencia del perfil/módulo, bloqueado por SSO expirado.
9. Configuración efectiva de Meta: app, WABA, phone number, webhook y permisos del token.
10. Existencia/validez de cada parámetro legacy SSM y si es SecureString; no se descifraron.
11. Contrato/costo de Gemini y reglas completas del agente; se inspeccionó el flujo Inbox, no se caracterizó cada tool de negocio.
12. Comportamiento Messenger/Instagram, actualmente deshabilitado por configuración.
13. Retención requerida por negocio: legacy expira mensajes/lista a 90 días; debe confirmarse si esa pérdida es aceptable en Hub.
14. Resultado exacto de eliminación ante millones de mensajes: legacy lanza un `Promise.all` no troceado.
15. Accesibilidad con lector de pantalla: varios iconos de estado están `aria-hidden` y el estado de entrega no tiene texto accesible.

## 10. Conclusiones para la siguiente fase

- La migración es cross-repo y no puede resolverse copiando solo Angular: requiere frontend, servicio Go, DynamoDB, S3/SSM, WebSocket/realtime, contrato OpenAPI e IAM funcional.
- La UI y lógica legacy están completamente inventariadas, incluidos estados, textos, paginación, caché, optimismo y realtime.
- El backend legacy relevante es `api-whatsapp-agent`, con diez endpoints administrativos de Inbox, dos webhooks y dos rutas WebSocket.
- `services/api-auth` no existe; usar `api-catalog`/`api-program` como patrón endpoint-per-function y `api-identity` exclusivamente para IAM/auth.
- El Lambda Authorizer no administra perfiles ni módulos. La fuente de verdad es `UsuariosTable`, gestionada por `api-identity`.
- El perfil Administrador real es `ADMIN`; `ADM` es el módulo padre Administración. La asignación debe apuntar a `PFL#ADMIN`.
- Para conservar la jerarquía legacy, Inbox debería vivir bajo un LV1 Comunicaciones, no bajo `ADM`, salvo decisión explícita contraria.
- No hay realtime destino. Debe diseñarse una alternativa segura que no transporte JWT persistente en query string.
- El `.env.dev` destino existe, está ignorado y solo debe servir como entrada local. Los valores reales se aplican a SSM SecureString; la plantilla versionada contiene placeholders.
- No se debe reutilizar el JWT legacy ni copiar secretos al repositorio/documentación.
