# Implementation Plan: program-form

## Overview

El plan separa tres frentes que conviene no mezclar: el **trabajo de plataforma** que
esta feature paga por ser la primera del proyecto, la **feature** propiamente tal
—formulario, motor de cálculo y salidas— y los **cuatro repositorios** involucrados,
cada uno con sus propios commits.

El orden respeta las dependencias reales que fija el diseño:

- `ind-hub-inf` (tablas) antes de que `api-catalog` pueda consultar nada.
- `libs/` antes de cualquier microservicio Go.
- El motor de cálculo en TypeScript antes de la tabla de resumen, la previsualización
  y los exportadores, porque todos consumen sus resultados.
- Los tres servicios Go no dependen entre sí: el orden entre ellos es libre.

### Repos y scopes de commit

| Repo                         | Alias en el plan | Scopes de commit que usa esta feature                     |
| ---------------------------- | ---------------- | --------------------------------------------------------- |
| `ind-hub-app-ngx-pri-gh`     | **app**          | `core`, `shared`, `program`                               |
| `ind-hub-api-gox-sls-pri-gh` | **api**          | `config`, `deps`, `configuration`, `favorites`, `program` |
| `ind-hub-inf-aws-sls-pri-gh` | **inf**          | `ddb`                                                     |
| `ind-hub-orc-aws-sls-pri-gh` | **orc**          | `docs`                                                    |

**Los commits van siempre separados por repo.** Ninguna tarea de este plan produce un
commit que toque dos repositorios a la vez.

---

## Bloqueos declarados

Dos decisiones condicionaron el plan y no son pendientes menores. Están acá arriba a
propósito; la segunda ya fue resuelta durante la implementación.

### Bloqueo 1 — Despliegue de `api-favorite` y `api-program`

**Estado: bloqueado. No se levanta dentro de esta spec.**

El Requirement 19 impide desplegar el CRUD de favoritos y el endpoint de presupuesto
mientras el Lambda Authorizer compartido esté inactivo. El authorizer depende de
`services/api-auth`, el servicio de login, **que no existe y está fuera del alcance de
esta spec**.

Consecuencias concretas sobre el plan:

- Las tareas 15 (`api-favorite`) y 16 (`api-program`) **se implementan y se prueban
  completas**, incluidos sus tests. Lo que queda bloqueado es el despliegue.
- La tarea 15.1 y la 16.1 incluyen una guarda explícita en `serverless.ts` que hace
  fallar el build con un mensaje que menciona el Requirement 19, para que un
  `make deploy` por descuido no falle con la excepción genérica del builder.
- El formulario se ejercita de punta a punta contra los servidores locales
  (`make dev service=services/api-<nombre>`), nunca contra `dev`.
- Lo desplegable al terminar este plan es una **calculadora sin capacidad de guardar**:
  cálculo reactivo, previsualización y exportación a Excel. La tarea 23.5 implementa el
  aviso al usuario que exige el Requirement 19.7.

### Bloqueo 2 — Porción pasajero-independiente

**Estado: resuelto el 14 de septiembre de 2026 por validación del solicitante.**

Incluir la tripulación y los servicios `per_day` en la porción pasajero-independiente
corrige una inconsistencia del legacy, pero **cambia los precios**: el precio por
persona baja del orden de 1% respecto del comportamiento actual.

- La variante validada incluye tripulación y servicios `fixed` y `per_day`.
- Las tareas 6.1 a 6.6 implementan la decisión en un único predicado y su reparto.
- La propiedad 14 se corrigió durante la implementación: la monotonía no es un
  invariante válido cuando el redondeo proporcional agrega un liberado. En su lugar,
  verifica que cada escenario reutilice exactamente el motor único, que es lo exigido
  por los Requirements 13.8 y 13.9.

---

## Tasks

- [x] 1. Plataforma frontend — configuración base de `ind-hub-app` (repo: **app**)
  - [x] 1.1 Agregar dependencias nuevas con versión fija y configurar Vitest
    - Agregar `fast-check` y `write-excel-file` con versión exacta, sin rango
    - Configurar Vitest con entorno `jsdom` y `setup-vitest.ts`
    - Verificar que `npm test` corra sobre un test trivial
    - _Requirements: 12.8_

  - [x] 1.2 Configurar `provideHttpClient`, locale `es-CL` y animaciones en `app.config.ts`
    - `provideHttpClient(withInterceptors([...]))`, `provideAnimationsAsync()`
    - Registrar `es-CL` con `registerLocaleData` y `LOCALE_ID`
    - El formato de montos del Requirement 9.7 depende de este locale
    - _Requirements: 9.7, 15.8_

  - [x] 1.3 Crear los interceptores HTTP y el contrato de respuesta
    - `core/http/api-response.interface.ts`: envelope `{ data }` y `{ code, message, details, traceId }`
    - `core/http/error.interceptor.ts`: traduce `code` a mensaje de usuario con el mapa del diseño; nunca muestra el `message` crudo del backend
    - `core/http/correlation-id.interceptor.ts`: genera un UUID por operación y lo envía en `X-Correlation-Id`
    - `core/notifications/notification.service.ts`: fachada sobre `MessageService` de PrimeNG
    - _Requirements: 1.5, 2.8, 10.10, 12.7, 13.14_

  - [x] 1.4 Crear el enrutamiento con carga diferida y el layout base
    - `app.routes.ts` hoy exporta un arreglo vacío: agregar la ruta `/programas` con `loadChildren`
    - `features/programas/programas.routes.ts` con la ruta del formulario
    - Layout base que aloja el título "Programa" y la bajada del Requirement 1.1
    - _Requirements: 1.1_

- [x] 2. Contrato de datos y constantes del programa (repo: **app**)
  - [x] 2.1 Escribir las interfaces del contrato consolidado
    - `interfaces/program.interface.ts`: `ChargeType`, `CurrencyCode`, `CatalogRef`, `ProgramGeneral`, `ProgramSchedule`, `ProgramPricing`, `ExchangeSnapshot`, `EffectiveRates`, `CrewMember`, `ProgramService`, `ProgramTotals`, `Program`, `SummaryRow`, `ScenarioShape`, `BudgetScenario`, `BudgetRequest`
    - `interfaces/catalog.interface.ts`, `exchange-rate.interface.ts`, `favorite.interface.ts`
    - `FavoriteContent` debe excluir `totals` y `exchange` **por tipo**, no por convención
    - _Requirements: 11.16, 11.17_

  - [x] 2.2 Escribir las constantes de la feature
    - `constants/field-limits.ts`: `FIELD_LIMITS` como única fuente de rangos
    - `constants/charge-types.ts`: los cinco tipos con sus etiquetas en español
    - `constants/scenario-defaults.ts`: `DEFAULT_SCENARIO_OFFSETS = [-10, -5, 0, 5]` y `MAX_SCENARIOS = 4`
    - _Requirements: 6.5, 13.3, 13.11_

- [x] 3. Generadores de `fast-check` (repo: **app**)
  - [x] 3.1 Escribir los generadores en `calculation/__arbitraries__/`
    - Son la pieza que decide si las propiedades sirven: se construyen para alcanzar fronteras, no valores promedio
    - `arbSchedule()`: 1 día, 100 días, cruce de año, 29 de febrero, 1 pasajero, liberados en `totalPassengers − 1`
    - `arbPricing()`: incrementos en 0 y en su máximo, utilidad y recargo en 0 y en 100
    - `arbService()`: los cinco tipos de cobro equiprobables, las tres monedas, precio en el mínimo y en el máximo
    - `arbCalculationInput()`: listas vacías, una fila, 100 servicios y 20 tripulantes, y **el caso de neto 0 generado de forma explícita**
    - `arbDocumentId()`: RUT, DNI y CPF válidos por construcción, con y sin formato
    - `arbProgramName()`: cadenas vacías, solo espacios, tildes, ñ, largos en 2, 3 y 4
    - `arbScenarioOffsets()`: listas vacías, un desplazamiento, más de cuatro, repetidos, y negativos mayores que los pasajeros del programa
    - `arbCatalogSettings()`: con y sin `margin`, con y sin `scenarioOffsets`, `utilityRate` en 0 y bajo el piso
    - _Requirements: 8.8, 13.7_

- [x] 4. Motor de cálculo — núcleo determinista (repo: **app**)
  - [x] 4.1 Implementar `rounding.ts` y `charge-type.ts`
    - `round` y `ceil` centralizados en un solo lugar
    - `baseAmount(item, schedule)` con las seis fórmulas de la tabla del diseño, usando `totalPassengers` con los liberados incluidos
    - _Requirements: 5.8, 6.6, 6.7, 6.8, 6.9, 6.10, 6.15_

  - [x]* 4.2 Escribir el test de propiedad del monto base
    - `Feature: program-form, Property 5: El monto base corresponde a la fórmula de su tipo de cobro`
    - `numRuns: 100`
    - _Requirements: 5.8, 6.6, 6.7, 6.8, 6.9, 6.10, 6.15_

  - [x] 4.3 Implementar `buildEffectiveRates` y los derivados del calendario
    - `buildEffectiveRates(pricing, snapshot)`: tasa del día + incremento, y `CLP: 1` fijo
    - `totalDays` como diferencia en días inclusive, 0 si el rango está invertido
    - `payingPassengers = max(1, totalPassengers − freePassengers)`
    - _Requirements: 3.2, 3.4, 3.9, 4.6, 4.7_

  - [x]* 4.4 Escribir los tests de propiedad del calendario y de las tasas
    - `Feature: program-form, Property 1: Los días totales cuentan ambos extremos del rango`
    - `Feature: program-form, Property 2: Un rango de fechas invertido anula los días`
    - `Feature: program-form, Property 3: Los pasajeros pagantes nunca bajan de uno`
    - `Feature: program-form, Property 4: La tasa efectiva es la tasa del día más el incremento, y el CLP no se altera`
    - Un test por propiedad, sin agrupar. `numRuns: 100`
    - _Requirements: 3.2, 3.4, 3.9, 4.6, 4.7_

  - [x] 4.5 Implementar `calculateProgram`: filas, subtotales, neto, utilidad, recargo y total
    - Construir `SummaryRow[]` durante el recorrido, con `key` estable y `passengerIndependent`
    - `amountCLP = baseAmount × tasa efectiva`; subtotales por moneda; `netRaw` sin redondear y `netCLP` redondeado
    - `utilityCLP = ceil(netRaw × utilityRate / 100)`, `netWithUtilityCLP = netCLP + utilityCLP`
    - `totalCLP = round(netWithUtilityCLP × (1 + rechargeRate / 100))`, `rechargeCLP` por diferencia
    - Conservar `netRaw` sin redondear: es el denominador de la partición y la base de la utilidad
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4_

  - [x]* 4.6 Escribir los tests de propiedad de la conversión y del neto
    - `Feature: program-form, Property 6: Los subtotales por moneda forman una partición exhaustiva del neto`
    - `Feature: program-form, Property 7: El neto es invariante frente al orden de los ítems`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 4.7 Escribir los tests de propiedad de utilidad, recargo y total
    - `Feature: program-form, Property 8: Sin utilidad ni recargo, el total iguala el neto`
    - `Feature: program-form, Property 9: La descomposición del total cierra exacta`
    - `Feature: program-form, Property 10: El total es monótono creciente respecto del precio de cualquier ítem`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x]* 4.8 Escribir los tests unitarios de casos límite del motor
    - Neto en 0, un solo pasajero, liberados en el máximo, precios en el mínimo, programa de 1 pasajero
    - _Requirements: 8.8_

- [x] 5. Checkpoint — motor de cálculo verificado
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Reparto por persona (repo: **app**)
  - [x] 6.1 Fijar en código el conjunto de ítems pasajero-independientes
    - **Validada el 14 de septiembre de 2026 por el solicitante:** la decisión cambia los precios respecto del legacy, del orden de 1% a la baja
    - Crear `calculation/passenger-independent.ts` con el predicado como único punto de decisión
    - Variante del diseño: tripulación + `fixed` + `per_day`. Variante legacy: solo `fixed`
    - Dejar en el Godoc/TSDoc del archivo cuál se validó y con quién, y actualizar el punto abierto 1
    - _Requirements: 8.7_

  - [x] 6.2 Implementar `per-passenger-split.ts`
    - `independentCLP` como suma de `amountCLP` de los ítems que el predicado de 6.1 marca
    - Sin liberados o con `netRaw` en 0: `ceil(amount / payingPassengers)`
    - Con liberados: `independentShare` entre `totalPassengers`, `dependentShare` entre `payingPassengers`, y `ceil` de la suma
    - _Requirements: 8.5, 8.6, 8.7, 8.8_

  - [x]* 6.3 Escribir el test de propiedad de la partición del monto
    - `Feature: program-form, Property 11: Las dos porciones suman el monto original`
    - _Requirements: 8.7_

  - [x]* 6.4 Escribir el test de propiedad de la recaudación del reparto
    - `Feature: program-form, Property 12: El precio por persona nunca recauda menos que el monto repartido`
    - _Requirements: 8.5, 8.6_

  - [x]* 6.5 Escribir el test de propiedad de la coincidencia de las dos ramas
    - `Feature: program-form, Property 13: Las dos ramas del reparto coinciden cuando no hay liberados`
    - _Requirements: 8.5, 8.6, 8.8_

  - [x] 6.6 Integrar el precio por persona en los totales
    - Exponer `netWithUtilityPerPassengerCLP` y `totalPerPassengerCLP` desde `calculateProgram`
    - _Requirements: 8.9_

- [x] 7. Escenarios del presupuesto (repo: **app**)
  - [x] 7.1 Implementar `deriveScenarios` y `calculateScenario`
    - Orden no intercambiable: desplazar, acotar a mínimo 1, aplicar la proporción de liberados, acotar liberados a `totalPassengers − 1`, deduplicar
    - `freeRatio` se calcula una vez sobre el programa y se reutiliza
    - Recortar a `MAX_SCENARIOS` en vez de fallar cuando el catálogo trae más desplazamientos
    - `calculateScenario` reconstruye la entrada y llama a `calculateProgram`, sin lógica duplicada
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.11_

  - [x]* 7.2 Escribir el test de propiedad de los escenarios derivados
    - `Feature: program-form, Property 15: Los escenarios derivados son válidos, acotados y distintos entre sí`
    - Verificar sobre `deriveScenarios` como función pura, sin componente
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.11_

  - [x]* 7.3 Escribir el test de propiedad del precio por escenario
    - La formulación original de monotonía se descartó porque el redondeo proporcional de liberados puede agregar un liberado y aumentar el precio por pagante
    - `Feature: program-form, Property 14: Cada escenario reutiliza el motor con sus cantidades derivadas`
    - _Requirements: 13.8, 13.9_

- [x] 8. Validadores, formateadores y formulario tipado (repo: **app**)
  - [x] 8.1 Implementar el validador de documento de identidad
    - `shared/validators/document-id.validator.ts`: RUT chileno, DNI argentino y CPF brasileño
    - _Requirements: 5.9_

  - [x]* 8.2 Escribir el test de propiedad del validador de documento
    - `Feature: program-form, Property 18: El validador de documento acepta los válidos y rechaza los mutados`
    - _Requirements: 5.9_

  - [x] 8.3 Implementar el formateador de montos en CLP
    - `shared/formatting/clp.formatter.ts`: entero a cadena `es-CL`, separador de miles, sin decimales
    - _Requirements: 9.7_

  - [x]* 8.4 Escribir el test de propiedad del formateador
    - `Feature: program-form, Property 30: El formato de montos en CLP es reversible`
    - _Requirements: 9.7_

  - [x] 8.5 Implementar los validadores numéricos y de rango de fechas derivados de `FIELD_LIMITS`
    - `numeric-range.validator.ts` construido desde `FIELD_LIMITS`, no con literales repetidos
    - `date-range.validator.ts`: término no anterior a inicio, máximo 100 días
    - Entero obligatorio cuando la moneda del ítem es CLP
    - _Requirements: 3.6, 3.7, 3.10, 5.10, 5.11, 6.16, 6.17, 6.18_

  - [x]* 8.6 Escribir el test de propiedad de los rangos numéricos
    - `Feature: program-form, Property 16: La validez de un campo numérico equivale a pertenecer a su rango`
    - _Requirements: 3.6, 3.7, 3.10, 5.10, 5.11, 6.16, 6.17, 6.18_

  - [x] 8.7 Implementar `program-form.builder.ts`
    - `FormGroup` tipado con `generals`, `schedule`, `pricing`, `crews` y `services`
    - **El formulario contiene únicamente lo que el usuario escribe.** Sin controles para `totalDays`, `payingPassengers`, `baseAmount`, `amountCLP`, tasas efectivas ni los nueve campos de `ProgramTotals`
    - `FormArray` de tripulantes y de servicios con una fila mínima y eliminación deshabilitada en esa fila
    - Nombre con largo mínimo 3 sobre el valor recortado; descripción opcional
    - Acciones de agregar, eliminar y duplicar fila
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.5, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.11, 6.12, 6.13, 6.14, 6.18_

  - [x]* 8.8 Escribir el test de propiedad del largo del nombre
    - `Feature: program-form, Property 17: La validez del nombre equivale a su largo mínimo`
    - _Requirements: 2.5_

  - [x] 8.9 Implementar `margin-preload.ts`
    - `applyMarginDefaults` escribe valores y **no toca validadores**: los cuatro controles nacen con `required` y lo conservan
    - Sin `margin` en la respuesta, los controles quedan en `null`, obligatorios e inválidos
    - Guarda `pristine`: si el usuario ya decidió, una respuesta tardía del catálogo no lo sobrescribe
    - `emitEvent: false` para no disparar un recálculo redundante
    - _Requirements: 4.10, 4.11_

  - [x]* 8.10 Escribir el test de propiedad de la precarga de margen y del piso de utilidad
    - `Feature: program-form, Property 23: La precarga de margen no relaja la obligatoriedad y el piso de utilidad no bloquea`
    - _Requirements: 4.10, 4.11, 4.12, 4.13_

  - [x] 8.11 Implementar `nights-preload.ts` y la máquina de dos estados de `nightsSource`
    - `NightsSource = 'preloaded' | 'user'` como signal del store, **no como control del formulario**
    - Precarga `max(1, totalDays − 1)` solo mientras la fuente sea `'preloaded'`
    - Guarda de reentrada `applyingPreload` para que el propio `setValue` no cuente como intervención
    - Cargar un favorito marca `'user'`; `form.reset()` vuelve a `'preloaded'`
    - _Requirements: 3.11, 3.12_

  - [x]* 8.12 Escribir el test de propiedad de la precarga de noches
    - `Feature: program-form, Property 24: Las noches se precargan hasta que el usuario decide, y después no`
    - Generar secuencias de cambios de fechas con y sin intervención del usuario intercalada
    - _Requirements: 3.11, 3.12_

- [x] 9. Estado y servicios HTTP del frontend (repo: **app**)
  - [x] 9.1 Implementar `exchange-rate.service.ts` y `exchange-rate.store.ts`
    - Una sola solicitud a `GET /tasas-cambio` al inicializar; estado de carga, error y reintento
    - `usingFallback` y `fallbackDate` como `computed()` sobre `snapshot()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7, 1.9_

  - [x] 9.2 Implementar `catalog.service.ts` y `catalog.store.ts`
    - Una sola petición a `GET /catalogos` con planes, temporadas, destinos y `settings`
    - Estado de carga que deshabilita los selectores, y estado de error con reintento
    - Respaldos del frontend cuando `margin` o `scenarioOffsets` se omiten
    - Preseleccionar `settings.defaultPlanId` solo si corresponde a un plan vigente, sin marcar el control como modificado
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10, 4.10, 4.11, 13.3, 16.8, 16.9, 16.11_

  - [x] 9.3 Implementar `program-form.store.ts` como puente entre el formulario y las señales
    - Suscripción **por sección** con `getRawValue()`, no al formulario completo ni al valor de `valueChanges`
    - `effectiveRates`, `derived`, `rows` y `totals` como `computed()`
    - `searchTerm` como signal aparte que `totals` no lee: el pie es estructuralmente incapaz de depender del filtro
    - `belowUtilityFloor` y la incoherencia noches/días como `computed()` no bloqueantes
    - _Requirements: 4.12, 4.13, 3.13, 3.14, 8.10, 9.6, 9.10_

- [x] 10. Checkpoint — cálculo, formulario y estado cableados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Infraestructura DynamoDB (repo: **inf**, scope `ddb`)
  - [x] 11.1 Crear las tablas `catalogos` y `favoritos` y exportar sus ARN
    - Dos entradas nuevas en `ddb/ddb-config.ts`, sin `overrides`: ninguna necesita GSI ni TTL
    - Ambas en `PAY_PER_REQUEST`, que es lo que mantiene el costo dentro del Free Tier
    - Exportar el ARN de cada tabla para que los servicios armen su política por referencia de CloudFormation
    - **No tocar la tabla `programas`**: esta spec no la usa y queda intacta para la spec de persistencia
    - Va primero porque una tabla que no existe no admite ni una consulta
    - _Requirements: 17.7, 17.8, 17.10, 17.11, 17.12_

- [x] 12. Plataforma backend Go — módulo `libs/` (repo: **api**, scope `config`/`deps`)
  - [x] 12.1 Crear el módulo `libs/` y registrar los tres servicios
    - `libs/go.mod`, y agregar `./libs`, `./services/api-catalog`, `./services/api-favorite` y `./services/api-program` a `go.work`
    - Registrar los tres servicios en `common/api-services.ts`, uno por uno
    - Agregar las dependencias Go nuevas repartidas: `aws-lambda-go`, `zap`, `echo`, `validator` y `ulid` donde corresponda; `dynamodb` solo en `api-catalog` y `api-favorite`; `gopdf` solo en `api-program`
    - `libs/` no existe hoy pese a estar documentado en `go-conventions.md`. Es trabajo de plataforma, no de la feature
    - _Requirements: 17.4, 17.6_

  - [x] 12.2 Implementar `libs/logger`, `libs/shared/apperr` y `libs/shared/resp`
    - `logger`: zap estructurado con `functionName`, `requestId` y `stage`. Prohibido `fmt.Println`
    - `apperr`: errores de dominio a HTTP más `code`, con los códigos del catálogo de `api-design.md`. **Sin códigos nuevos**
    - `resp`: envelope de éxito y de error con `traceId` tomado del `requestId` del evento
    - Un error esperado se registra como `warn`; `error` queda reservado para lo inesperado
    - _Requirements: 14.9, 18.4, 18.5_

  - [x] 12.3 Implementar `libs/lambdautil`
    - `bind.go`, `validate.go` con el validador `documentid` registrado, `response.go`
    - `identity.go` con `UserIDFromContext`, que lee de `requestContext.authorizer.lambda` y devuelve error si no está
    - `echo-adapter.go` como puente Echo ↔ APIGatewayV2 para el servidor local, que inyecta un usuario fijo de desarrollo en ese mismo lugar del contexto
    - _Requirements: 19.5, 19.8_

  - [x] 12.4 Implementar `libs/awsddb`
    - Cliente DynamoDB con la superficie mínima que estos endpoints usan: `GetItem`, `Query`, `PutItem`, `UpdateItem`, `DeleteItem`
    - **Sin `Scan` expuesto.** La superficie es la única interfaz que el diseño introduce, y existe porque hay dos implementaciones: la de AWS y la de los tests
    - _Requirements: 16.2_

  - [x] 12.5 Implementar `libs/domain/program`
    - `charge_type.go`, `catalog.go`, `program.go`, `exchange.go`, `scenario.go`, `limits.go`
    - `CatalogSettings` con punteros y `omitempty` para distinguir un cero legítimo de un campo ausente
    - `ScheduleContent` y `PricingContent` sin campos derivados ni `ExchangeSnapshot`
    - Es lo que sostiene la independencia de los tres servicios: `api-favorite` y `api-program` importan de acá y nunca uno del otro
    - _Requirements: 17.5, 17.6, 16.8, 16.9_

  - [x] 12.6 Extender `buildGoServiceServerless` con permisos IAM por función
    - El builder actual no emite `provider.iam` ni `iamRoleStatements`: sin eso ninguna función puede tocar DynamoDB
    - Los builders de políticas ya existen en `aws/policies/dynamodb.ts`. Lo que falta es el punto de conexión
    - La política se declara **por función**, no por servicio: `fn-obtener-catalogos-v1` recibe lectura y su vecino `fn-obtener-tasas-cambio-v1` recibe CRUD
    - _Requirements: 17.9, 17.10, 17.11, 17.12_

  - [x] 12.7 Crear los `configs/.env.local` por servicio
    - Tres archivos, uno por servicio, para desarrollo local sin SSM
    - _Requirements: 19.5_

- [x] 13. `services/api-catalog` — catálogos y tipos de cambio (repo: **api**, scope `configuration`)
  - [x] 13.1 Crear el scaffold del servicio
    - `go.mod`, `service.config.json`, `functions/app.go`, `config.go` con el nombre de la tabla `catalogos`, `routes.go`
    - `serverless.ts` con **ambos endpoints `public: true`** y las políticas por función de la tabla 12.6
    - Memoria y timeout por función: tasas 128 MB / 30 s, catálogos 128 MB / 6 s
    - El path de `serverless.ts` y el que registra `endpoint.go` se derivan de una constante única por endpoint
    - _Requirements: 17.2, 19.1, 19.2_

  - [x] 13.2 Implementar el dominio de persistencia del servicio
    - `domain/keys.go`: `pk = CATALOG` con `sk = <scope>#<order:04d>#<id>`, `sk = SETTINGS`, y `pk = RATES` con `sk = LATEST`
    - Relleno de ceros a cuatro dígitos para que el orden lexicográfico coincida con el numérico
    - `domain/catalog_item.go` y `domain/rate_item.go`
    - _Requirements: 16.2, 16.3, 14.4_

  - [x] 13.3 Implementar `fn-query-catalog.go` y el endpoint de catálogos
    - Un único `Query` sobre `pk = CATALOG` resuelve planes, temporadas, destinos y `settings`
    - Separar los ítems por su `sk`; omitir las opciones inactivas; exponer `budgetTemplateId` en los destinos
    - Omitir `margin` y `scenarioOffsets` de la respuesta cuando el ítem `SETTINGS` no los declara
    - Cabecera `Cache-Control: max-age=300`
    - Log `info` con `optionCount`, `hasMargin`, `hasScenarioOffsets`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_

  - [x]* 13.4 Escribir el test de propiedad de los catálogos
    - `Feature: program-form, Property 38: Los catálogos nunca exponen opciones inactivas`
    - Table-driven con `testing` de la biblioteca estándar, sustituyendo el cliente DynamoDB
    - _Requirements: 16.3, 16.4_

  - [x] 13.5 Implementar `fn-fetch-rates.go`
    - Fuente `@fawazahmed0/currency-api` vía jsDelivr, dos peticiones en paralelo
    - Timeout de 10 s por consulta, hasta 3 reintentos con espera creciente de factor 2
    - Redondeo al entero más cercano; una respuesta sin USD o sin BRL se trata como consulta fallida
    - Fechas divergentes: se usa la del USD y se registra `warn` con `usdDate` y `brlDate`
    - _Requirements: 14.1, 14.3, 14.6, 14.7, 14.11, 14.12_

  - [x]* 13.6 Escribir los tests de propiedad del redondeo y de la fecha
    - `Feature: program-form, Property 33: Las tasas se redondean al entero más cercano`
    - `Feature: program-form, Property 36: La fecha de la respuesta es siempre la del USD`
    - _Requirements: 14.3, 14.12_

  - [x] 13.7 Implementar `fn-rate-snapshot.go` y el endpoint de tasas
    - Éxito: `PutItem` sobre `pk=RATES`/`sk=LATEST` con `date` de la fuente y `fetchedAt` del reloj, y respuesta con `isFallback: false`
    - La escritura ocurre **después** de armar la respuesta y su fallo no hace fallar la petición: `warn` con `snapshotWriteError` y respuesta con las tasas frescas
    - Tres intentos fallidos con snapshot: respuesta con fecha original e `isFallback: true`, más `warn` con `snapshotDate`, `snapshotFetchedAt` y `attempts`
    - Tres intentos fallidos sin snapshot: 502 con `UPSTREAM_SERVICE_ERROR`
    - _Requirements: 14.2, 14.4, 14.5, 14.8, 14.9, 14.10_

  - [x]* 13.8 Escribir los tests de propiedad del snapshot de respaldo
    - `Feature: program-form, Property 34: Una consulta exitosa deja snapshot sin marca, y una fallida lo entrega marcado`
    - `Feature: program-form, Property 35: Una respuesta externa inutilizable sin snapshot produce un error de upstream`
    - _Requirements: 14.4, 14.5, 14.7, 14.8, 14.9_

  - [x] 13.9 Cablear los entrypoints Lambda y el servidor local
    - `cmd/fn-obtener-catalogos-v1/main.go`, `cmd/fn-obtener-tasas-cambio-v1/main.go` y `cmd/local-api/main.go`
    - Verificar que `make dev service=services/api-catalog` responda ambas rutas vía Echo
    - _Requirements: 17.2, 19.5_

- [x] 14. Siembra inicial de catálogos y parámetros (repo: **api**, scope `configuration`)
  - [x] 14.1 Escribir el script de siembra de la tabla `catalogos`
    - **La decisión entre script de siembra y endpoint de administración sigue abierta** (punto abierto 3 de `requirements.md`). Este plan implementa el script porque es lo que desbloquea el desarrollo; si más adelante se elige el endpoint, este script queda como herramienta de desarrollo
    - Cargar planes, temporadas y destinos con su `order`, `active` y `budgetTemplateId`
    - Cargar el ítem `SETTINGS` con `defaultPlanId`, `margin` y `scenarioOffsets`
    - Idempotente: reejecutarlo deja la tabla en el mismo estado
    - _Requirements: 2.9, 16.1, 16.5, 16.6, 16.7, 16.11_

- [x] 15. `services/api-favorite` — CRUD de favoritos, **despliegue bloqueado** (repo: **api**, scope `favorites`)
  - [x] 15.1 Crear el scaffold del servicio con la guarda de authorizer
    - `serverless.ts` con los cuatro endpoints declarados como **`public: false`**, y la guarda que lanza `Error` con mensaje que menciona el Requirement 19 mientras `SHARED_AUTHORIZER_ENABLED` esté apagado
    - `go.mod`, `service.config.json`, `app.go`, `config.go` con el nombre de la tabla `favoritos`, `routes.go`
    - Política `dynamodbReadPolicy` en la función de listar y `dynamodbCrudPolicy` en las de escritura, ambas solo sobre `favoritos`
    - Memoria y timeout: 128 MB / 6 s
    - **Se implementa y se prueba completo. No se despliega.**
    - _Requirements: 17.3, 17.8, 17.11, 19.3, 19.4_

  - [x] 15.2 Implementar el dominio del favorito
    - `domain/favorite.go`: `Favorite` y `FavoriteContent` compuesto desde `libs/domain/program`
    - `FavoriteContent` omite **por tipo** los totales y el `ExchangeSnapshot`
    - `domain/keys.go`: `pk = USER#<userId>`, `sk = FAV#PROGRAMA#<ulid>`
    - El ULID ordena por fecha de creación al ordenar por `sk`: no se agrega `createdAt` a la clave
    - _Requirements: 11.16, 11.17, 17.5_

  - [x] 15.3 Implementar `fn-listar-favoritos-v1`
    - `Query` con `pk = USER#<id>` y `begins_with(sk, "FAV#PROGRAMA#")`, orden descendente
    - `userId` desde `UserIDFromContext`; un `userId` en el cuerpo se ignora y se registra como `warn`
    - _Requirements: 11.5, 19.8_

  - [x] 15.4 Implementar `fn-crear-favorito-v1`
    - Validar el contenido con los límites de `libs/domain/program`; `VALIDATION_ERROR` o `REQUIRED_FIELD_MISSING` según el caso
    - ULID como identificador, `createdAt` y `updatedAt`
    - Log `info` con `favoriteId`, `userId` y `operation`. Sin el contenido del favorito, sin nombres ni documentos de tripulantes
    - _Requirements: 11.13, 11.16, 11.17, 19.8_

  - [x] 15.5 Implementar `fn-actualizar-favorito-v1` y `fn-eliminar-favorito-v1`, y cablear los entrypoints
    - `RESOURCE_NOT_FOUND` cuando el favorito no existe en la partición del usuario
    - Los cuatro `cmd/fn-*/main.go` y `cmd/local-api/main.go`
    - Verificar que `make dev service=services/api-favorite` responda las cuatro rutas
    - _Requirements: 11.12, 11.15, 19.5, 19.8_

  - [x]* 15.6 Escribir el test de propiedad de la identidad del usuario
    - `Feature: program-form, Property 39: La identidad del usuario proviene del contexto del authorizer`
    - _Requirements: 19.8_

- [x] 16. `services/api-program` — PDF de presupuesto, **despliegue bloqueado** (repo: **api**, scope `program`)
  - [x]* 16.1 Crear el scaffold del servicio sin acceso a DynamoDB
    - `serverless.ts` con el endpoint `public: false` y la misma guarda de authorizer de 15.1
    - `config.go` **sin nombre de tabla** y rol IAM **sin política de DynamoDB**: los Requirements 17.9 y 17.12 quedan implementados por construcción
    - Memoria y timeout: 512 MB / 20 s, por el PDF en memoria y no por aritmética
    - _Requirements: 17.1, 17.9, 17.12, 19.3, 19.4_

  - [x]* 16.2 Implementar `domain/budget_request.go`
    - `BudgetRequest` y `BudgetScenario` con las etiquetas `validate` del diseño
    - Montos en CLP como `int64`: llegan ya redondeados desde el frontend
    - _Requirements: 13.10, 18.1_

  - [x]* 16.3 Implementar `fn-validate-request.go`
    - Cuatro comprobaciones de forma: escenarios entre 1 y 4, precio por persona mayor que 0, al menos un pagante y `payingPassengers == totalPassengers − freePassengers`, y `budgetTemplateId` registrado
    - **El endpoint no recalcula precios.** Verifica que sean posibles, no que sean correctos
    - Log `warn` del rechazo con `reason` y `scenarioIndex`, sin los precios
    - _Requirements: 18.4, 18.5, 18.6, 18.7, 18.8_

  - [x]* 16.4 Escribir el test de propiedad de la validación del presupuesto
    - `Feature: program-form, Property 37: El presupuesto rechaza todo cuerpo cuya forma sea imposible`
    - Usar `testing/quick` de la biblioteca estándar con `MaxCount: 100`, sin dependencia nueva
    - _Requirements: 18.5, 18.6, 18.7, 18.8_

  - [x]* 16.5 Implementar el compositor de PDF, el registro de plantillas y el endpoint
    - `templates/registry.go` mapea `budgetTemplateId` a plantilla y es lo que permite validar antes de dibujar
    - Capa de composición por bloques sobre `signintech/gopdf`: `Header`, `TripSummary`, `ServiceList`, `ScenarioTable`, `Footer`
    - `templates/brochure-default.go` declara la secuencia común inicial para todos los destinos
    - Respuesta `application/pdf` en base64; **no se almacena en S3**
    - Log `info` con `budgetTemplateId`, `scenarioCount` y `pdfBytes`
    - Cablear `cmd/fn-generar-presupuesto-v1` y `cmd/local-api`
    - Test de ejemplo: el documento se genera sin error, su tamaño es mayor que cero y la plantilla corresponde al identificador. La apariencia es revisión humana
    - _Requirements: 18.1, 18.2, 18.3, 18.9_

- [x] 17. Checkpoint — backend implementado y probado
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Paneles del formulario (repo: **app**)
  - [x] 18.1 Implementar `general-data-panel`
    - Nombre, descripción, plan, temporada, destino y ciudad de salida
    - Selectores alimentados por `CatalogStore` y deshabilitados mientras carga
    - Mensajes de validación bajo cada campo obligatorio tras enfocarlo, asociados con `aria-describedby` y `aria-invalid`
    - Recibe su `FormGroup` por input y no inyecta servicios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 15.1, 15.2, 15.4_

  - [x] 18.2 Implementar `schedule-panel`
    - Rango de fechas, días totales de solo lectura, noches, pasajeros y liberados
    - Advertencia no bloqueante de incoherencia noches/días en la región `aria-live="polite"`
    - Validación de al menos un pasajero pagante y de duración máxima
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.8, 3.10, 3.13, 3.14, 15.9_

  - [x] 18.3 Implementar `pricing-panel`
    - Incrementos USD y BRL en múltiplos de 5 con sus topes distintos, utilidad y recargo
    - Mostrar por divisa la tasa del día, la tasa efectiva y el porcentaje de resguardo que el incremento representa
    - Advertencia no bloqueante de piso de utilidad en la región `aria-live`, que no deshabilita ninguna acción
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.12, 4.13, 15.9_

  - [x] 18.4 Implementar `crew-panel`
    - Filas con nombre, documento, precio diario y moneda; agregar y eliminar
    - Eliminar deshabilitado cuando queda una sola fila; `aria-label` en los controles de icono
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10, 5.11, 15.5_

  - [x] 18.5 Implementar `services-panel`
    - Filas con nombre, tipo de cobro, precio unitario y moneda; agregar, duplicar y eliminar
    - Duplicar agrega al final una fila con idénticos valores
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.11, 6.12, 6.13, 6.14, 6.16, 6.17, 6.18, 15.5_

  - [x] 18.6 Implementar `fallback-rates-notice`
    - Componente presentacional que recibe la fecha por input y no inyecta nada
    - Un solo lugar donde el mensaje está redactado, tres donde se renderiza
    - _Requirements: 1.7, 9.12, 10.6_

  - [x]* 18.7 Escribir el test de propiedad de duplicar servicio
    - `Feature: program-form, Property 21: Duplicar un servicio reproduce todos sus valores`
    - _Requirements: 6.12_

  - [x]* 18.8 Escribir el test de propiedad de accesibilidad de los controles
    - `Feature: program-form, Property 40: Todo control tiene nombre accesible y todo campo tiene etiqueta`
    - Recorrer el árbol renderizado con cantidades variables de filas de tripulantes y servicios
    - _Requirements: 15.4, 15.5_

- [x] 19. Tabla de resumen (repo: **app**)
  - [x] 19.1 Implementar `summary-table`
    - Oculta mientras no haya ningún ítem con datos válidos; una fila por tripulante y por servicio
    - Columnas: nombre, tipo, moneda, tasa efectiva, precio unitario, monto base y monto en CLP
    - Pie con los nueve montos; etiqueta visual por tipo de cobro y una propia para tripulación, **con texto y no solo color**
    - Buscador con `debounceTime(150)` que filtra filas e indica cuántas se muestran del total; el pie ignora el filtro
    - `<table>` semántica con `<th scope="col">`, `OnPush`, `@for` con `track` sobre `SummaryRow.key`, y virtual scrolling a partir de 50 filas
    - Aviso de tasas de respaldo junto a los valores de USD y BRL
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.11, 9.12_

  - [x]* 19.2 Escribir el test de propiedad de la visibilidad de la tabla
    - `Feature: program-form, Property 28: La tabla se muestra exactamente cuando hay algún ítem válido`
    - _Requirements: 9.1, 9.2_

  - [x]* 19.3 Escribir el test de propiedad de independencia del pie
    - `Feature: program-form, Property 29: Los totales del pie no dependen del filtro de búsqueda`
    - _Requirements: 9.10_

- [x] 20. Página del formulario y previsualización (repo: **app**)
  - [x] 20.1 Implementar `program-form.page` como container
    - Orquesta y no calcula: solicita tasas y catálogos una vez al inicializar, aplica las precargas y compone los paneles y la tabla
    - Indicador de carga en la zona de divisas y mensajes de reintento de tasas y de catálogos
    - Acción "Previsualizar" al pie, deshabilitada sin tasas o con algún campo obligatorio inválido
    - Paneles colapsables de PrimeNG por sección, orden del DOM igual al visual, sin `tabindex` positivos
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 2.6, 2.8, 10.1, 10.2, 15.1, 15.2, 15.3, 15.8_

  - [x] 20.2 Implementar `preview-dialog`
    - Se arma con el estado local, sin pedir nada al backend
    - Muestra generales, fechas y cantidades, parámetros de precio, detalle de tripulación, detalle de servicios y los totales
    - Fecha del snapshot y valores de USD y BRL; aviso de respaldo con `fallback-rates-notice`
    - Expone exportar a Excel, exportar a PDF y guardar favorito; ninguna acción cierra el diálogo
    - Indicador de carga y acciones deshabilitadas mientras una operación está en curso
    - Foco al primer elemento interactivo, retención de foco, `Escape` cierra conservando valores, y el foco vuelve al botón que lo abrió
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 15.6, 15.7_

  - [x] 20.3 Escribir el test de propiedad de la dependencia de las tasas
    - `Feature: program-form, Property 19: Sin tipos de cambio no se puede previsualizar`
    - _Requirements: 1.6_

  - [x]* 20.4 Escribir el test de propiedad de la habilitación de las acciones
    - `Feature: program-form, Property 20: Un solo campo obligatorio inválido deshabilita la previsualización`
    - _Requirements: 10.2, 11.14_

  - [x]* 20.5 Escribir el test de propiedad de la conservación del formulario
    - `Feature: program-form, Property 22: Cerrar la previsualización o fallar una acción conserva el formulario`
    - _Requirements: 10.8, 10.10, 15.7_

- [x] 21. Exportación del detalle a Excel (repo: **app**)
  - [x]* 21.1 Implementar `excel-layout.ts`
    - Construye filas, estilos y nombre de archivo **sin importar la librería**, para poder testearlo sin cargarla ni tocar el disco
    - Encabezado con nombre del programa, fecha de exportación, pasajeros, liberados, tasa del día y tasa efectiva por divisa
    - Detalle de todas las filas del programa y sección de resumen con los totales
    - Nombre del archivo en minúsculas con espacios reemplazados por guiones bajos
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

  - [x]* 21.2 Escribir los tests de propiedad del layout de Excel
    - `Feature: program-form, Property 31: El Excel exporta el programa completo`
    - `Feature: program-form, Property 32: El nombre del archivo es derivable y válido`
    - _Requirements: 12.3, 12.5_

  - [x]* 21.3 Implementar `excel-exporter.ts` con carga diferida y cablearlo en la previsualización
    - `await import('write-excel-file/browser')` para que el peso no entre al chunk inicial (entrada de navegador de la versión 4.x)
    - Acciones de exportación deshabilitadas durante la generación y rehabilitadas ante error, con mensaje
    - _Requirements: 12.1, 12.6, 12.7, 12.8_

- [x] 22. Exportación del presupuesto a PDF (repo: **app**)
  - [x]* 22.1 Implementar `budget-pdf.service.ts`
    - `POST /programas:presupuesto` con el cuerpo del Requirement 13.10, y descarga del PDF desde la respuesta en base64
    - _Requirements: 13.10, 13.11, 13.12_

  - [x]* 22.2 Cablear la exportación a PDF en la previsualización
    - Derivar escenarios con `deriveScenarios` y calcular cada precio por persona con `calculateScenario`
    - Destino sin seleccionar: mensaje y **no se llama al endpoint**
    - Error del endpoint: mensaje y acciones de exportación habilitadas de nuevo
    - _Requirements: 13.1, 13.2, 13.9, 13.13, 13.14_

- [x] 23. Panel de favoritos (repo: **app**)
  - [x]* 23.1 Implementar `favorites.service.ts` y `favorites.store.ts`
    - Listar, crear, actualizar y eliminar contra `api-favorite`; scope `programa`
    - El contenido enviado omite los totales y el snapshot de tipo de cambio
    - _Requirements: 11.5, 11.16, 11.17_

  - [x]* 23.2 Implementar el componente `favorites-panel`
    - Panel lateral anclado al borde derecho; el scope llega por input para que otra feature lo reutilice
    - En pantalla pequeña se superpone con capa de fondo que lo cierra; en escritorio alterna entre expandido y riel de iconos
    - Buscador por nombre que filtra en el cliente, estado vacío con instrucciones, y las acciones seleccionar, visualizar y eliminar
    - Diálogo de solo lectura para visualizar, y confirmación antes de eliminar, apilados con retención de foco propia
    - Solicita los favoritos al abrirse
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.11, 11.12, 15.5, 15.6_

  - [x]* 23.3 Implementar guardar, actualizar y cargar un favorito
    - Diálogo que solicita el nombre; guardar deshabilitado con algún campo obligatorio inválido
    - Nombre coincidente con el del favorito seleccionado, tras normalizar espacios y mayúsculas: actualiza en vez de crear
    - Seleccionar carga el contenido, cierra el panel, marca `nightsSource` en `'user'` y recalcula con el snapshot vigente
    - _Requirements: 11.9, 11.10, 11.13, 11.14, 11.15_

  - [x]* 23.4 Escribir los tests de propiedad del ciclo de vida del favorito
    - `Feature: program-form, Property 25: Guardar y cargar un favorito reproduce el contenido`
    - `Feature: program-form, Property 26: Un favorito cargado se calcula con la tasa vigente`
    - `Feature: program-form, Property 27: Un nombre coincidente actualiza en vez de crear`
    - Un test por propiedad, sin agrupar. La 27 normaliza espacios y mayúsculas antes de comparar
    - _Requirements: 11.9, 11.10, 11.15_

  - [x]* 23.5 Implementar el aviso de guardado no disponible
    - Cuando `api-favorite` no está desplegado, el formulario opera como calculadora e **indica al usuario** que el guardado de favoritos no está disponible
    - `favoritesEnabled` queda activo solo en `local`; los ambientes `dev` y `prd` muestran el aviso y deshabilitan las acciones
    - Es la consecuencia visible del Bloqueo 1 de este plan
    - _Requirements: 19.6, 19.7_

- [x] 24. Fragmentos OpenAPI de los endpoints nuevos (repo: **orc**, scope `docs`)
  - [x] 24.1 Escribir un fragmento OpenAPI por servicio
    - Tres fragmentos, no uno solo: `api-catalog` con dos endpoints, `api-favorite` con cuatro y `api-program` con uno
    - Paths en español, plural, kebab-case, sin tildes, con `:accion` para la operación no CRUD
    - Sin códigos de error nuevos: los siete endpoints usan el catálogo de `api-design.md`
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 25. Verificaciones de humo del despliegue
  - [x] 25.1 Verificar la superficie de endpoints públicos (repo: **api**)
    - Los dos endpoints de `api-catalog` están marcados públicos
    - `api-favorite` y `api-program` **fallan el build** con el mensaje explicativo mientras `SHARED_AUTHORIZER_ENABLED` esté apagado
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 25.2 Verificar la independencia de los servicios (repo: **api**)
    - Ningún `go.mod` de un servicio declara a otro servicio como dependencia
    - _Requirements: 17.5, 17.6_

  - [x] 25.3 Verificar la superficie IAM (repo: **api**)
    - `api-program` **no declara política de DynamoDB**
    - Las de `api-catalog` y `api-favorite` apuntan solo a su propia tabla, y la de listar favoritos es de lectura
    - _Requirements: 17.9, 17.10, 17.11, 17.12_

  - [x] 25.4 Verificar el peso del bundle inicial (repo: **app**)
    - La librería de Excel no aparece en el chunk inicial del build de producción
    - El presupuesto es 500 kB de advertencia y 1 MB de error
    - _Requirements: 12.8_

- [x] 26. Checkpoint final
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Las tareas marcadas con `*` no bloquean el resto del plan. Son la exportación a
  Excel (21), la exportación a PDF (22 y el servicio `api-program` de la tarea 16), el
  panel de favoritos (23) y los tests. El formulario calcula, previsualiza y muestra
  la tabla de resumen sin ninguna de ellas.
- **Dentro de lo opcional hay una jerarquía.** Los tests de propiedad 1 a 15 son la
  única verificación automatizada del dinero de la feature: no hay un segundo motor
  que sirva de contraste ni un recálculo autoritativo en el backend que atrape una
  diferencia. Son lo último que conviene omitir.
- Cada test de propiedad implementa **una sola** propiedad del diseño, con
  `numRuns: 100` como mínimo y la etiqueta
  `Feature: program-form, Property {número}: {enunciado}`.
- Las 40 propiedades del diseño están asignadas: 1 a 4 en 4.4, 5 en 4.2, 6 y 7 en 4.6,
  8 a 10 en 4.7, 11 a 13 en 6.3–6.5, 14 en 7.3, 15 en 7.2, 16 en 8.6, 17 en 8.8,
  18 en 8.2, 19 en 20.3, 20 en 20.4, 21 en 18.7, 22 en 20.5, 23 en 8.10, 24 en 8.12,
  25 a 27 en 23.4, 28 en 19.2, 29 en 19.3, 30 en 8.4, 31 y 32 en 21.2,
  33 y 36 en 13.6, 34 y 35 en 13.8, 37 en 16.4, 38 en 13.4, 39 en 15.6, 40 en 18.8.
- Los commits van separados por repo. Ninguna tarea mezcla frontend y backend.
- Lo que este plan **no** incluye, porque el diseño lo descarta explícitamente:
  motor de cálculo en Go, vectores de cálculo compartidos, `POST /programas`, clave de
  idempotencia, código `TOTALS_MISMATCH`, GSI o TTL sobre `programas`, y cacheo de
  tipos de cambio.

---

## Task Dependency Graph

Las tareas de una misma ola son independientes entre sí y pueden avanzar en paralelo.
Una ola solo puede empezar cuando todas las anteriores están cerradas. Los checkpoints
(5, 10, 17, 26) y las tareas padre no aparecen: el grafo es de sub-tareas hoja.

```mermaid
graph LR
    subgraph W0["Ola 0 · arranque de los cuatro repos"]
        direction TB
        T14["1.1 deps + Vitest"]
        T21["2.1 interfaces"]
        T111["11.1 tablas DynamoDB"]
        T121["12.1 libs/ + go.work"]
    end

    subgraph W1["Ola 1 · configuración base"]
        direction TB
        T12["1.2 HttpClient + es-CL"]
        T13["1.3 interceptores"]
        T22["2.2 constantes"]
        T122["12.2 logger · apperr · resp"]
        T125["12.5 libs/domain/program"]
    end

    subgraph W2["Ola 2 · plataforma cerrada"]
        direction TB
        T15["1.4 enrutamiento + layout"]
        T31["3.1 generadores fast-check"]
        T123["12.3 lambdautil"]
        T124["12.4 awsddb"]
        T126["12.6 IAM por función"]
        T127["12.7 .env.local por servicio"]
    end

    subgraph W3["Ola 3 · núcleo del motor y scaffolds"]
        direction TB
        T41["4.1 rounding + chargeType"]
        T43["4.3 tasas + derivados"]
        T81["8.1 validador documento"]
        T83["8.3 formateador CLP"]
        T131["13.1 scaffold api-catalog"]
        T151["15.1 scaffold api-favorite"]
        T161["16.1 scaffold api-program"]
    end

    subgraph W4["Ola 4 · cálculo completo y dominios Go"]
        direction TB
        T42["4.2 P5"]
        T44["4.4 P1·P2·P3·P4"]
        T45["4.5 calculateProgram"]
        T85["8.5 validadores de rango"]
        T132["13.2 dominio catalogos"]
        T152["15.2 dominio favorito"]
        T162["16.2 budget_request"]
        T241["24.1 fragmentos OpenAPI"]
    end

    subgraph W5["Ola 5 · propiedades del motor y endpoints"]
        direction TB
        T46["4.6 P6·P7"]
        T47["4.7 P8·P9·P10"]
        T48["4.8 unitarios límite"]
        T87["8.7 form builder"]
        T133["13.3 endpoint catalogos"]
        T135["13.5 fetch rates"]
        T153["15.3 listar favoritos"]
        T163["16.3 validación presupuesto"]
    end

    subgraph W6["Ola 6 · precargas y respaldo de tasas"]
        direction TB
        T61["6.1 BLOQUEADA · porción independiente"]
        T89["8.9 margin-preload"]
        T811["8.11 nights-preload"]
        T134["13.4 P38"]
        T136["13.6 P33·P36"]
        T137["13.7 snapshot de respaldo"]
        T154["15.4 crear favorito"]
        T164["16.4 P37"]
    end

    subgraph W7["Ola 7 · reparto, stores y cierre del backend"]
        direction TB
        T62["6.2 per-passenger-split"]
        T91["9.1 store de tasas"]
        T92["9.2 store de catálogos"]
        T138["13.8 P34·P35"]
        T139["13.9 entrypoints api-catalog"]
        T141["14.1 script de siembra"]
        T155["15.5 actualizar · eliminar"]
        T165["16.5 compositor PDF"]
    end

    subgraph W8["Ola 8 · propiedades del reparto y puente de estado"]
        direction TB
        T63["6.3 P11"]
        T64["6.4 P12"]
        T65["6.5 P13"]
        T66["6.6 precio por persona"]
        T93["9.3 program-form.store"]
        T156["15.6 P39"]
        T810["8.10 P23"]
        T812["8.12 P24"]
        T82["8.2 P18"]
        T84["8.4 P30"]
        T86["8.6 P16"]
        T88["8.8 P17"]
    end

    subgraph W9["Ola 9 · escenarios y paneles"]
        direction TB
        T71["7.1 deriveScenarios"]
        T181["18.1 generales"]
        T182["18.2 fechas"]
        T183["18.3 precios"]
        T184["18.4 tripulación"]
        T185["18.5 servicios"]
        T186["18.6 aviso de respaldo"]
    end

    subgraph W10["Ola 10 · tabla de resumen"]
        direction TB
        T72["7.2 P15"]
        T73["7.3 P14"]
        T187["18.7 P21"]
        T188["18.8 P40"]
        T191["19.1 summary-table"]
    end

    subgraph W11["Ola 11 · página y capas de salida"]
        direction TB
        T192["19.2 P28"]
        T193["19.3 P29"]
        T201["20.1 program-form.page"]
        T211["21.1 excel-layout"]
        T231["23.1 servicio de favoritos"]
    end

    subgraph W12["Ola 12 · previsualización"]
        direction TB
        T202["20.2 preview-dialog"]
        T213["21.3 excel-exporter"]
        T221["22.1 budget-pdf.service"]
        T232["23.2 favorites-panel"]
    end

    subgraph W13["Ola 13 · cableado de las salidas"]
        direction TB
        T203["20.3 P19"]
        T204["20.4 P20"]
        T205["20.5 P22"]
        T212["21.2 P31·P32"]
        T222["22.2 PDF en el diálogo"]
        T233["23.3 guardar · P27"]
        T235["23.5 aviso sin guardado"]
    end

    subgraph W14["Ola 14 · cierre y humo"]
        direction TB
        T234["23.4 P25·P26"]
        T251["25.1 endpoints públicos"]
        T252["25.2 independencia go.mod"]
        T253["25.3 superficie IAM"]
        T254["25.4 bundle inicial"]
    end

    W0 --> W1 --> W2 --> W3 --> W4 --> W5 --> W6 --> W7
    W7 --> W8 --> W9 --> W10 --> W11 --> W12 --> W13 --> W14

    style T61 fill:#ffebee,stroke:#c62828,stroke-width:2px
    style T151 fill:#fff8e1,stroke:#f9a825
    style T161 fill:#fff8e1,stroke:#f9a825
    style T111 fill:#e8f5e9,stroke:#2e7d32
    style T121 fill:#e8f5e9,stroke:#2e7d32
```

Tres cosas que el grafo hace explícitas:

- **La tarea 6.1 está en rojo** porque es la única bloqueada por validación de negocio.
  Las olas 0 a 5 y todo lo que no cuelga de ella avanzan sin esperarla. Si la
  validación se demora, la ola 6 arranca igual con 8.9, 8.11, 13.4, 13.6, 13.7, 15.4 y
  16.4, y 6.1 se incorpora cuando llegue la respuesta.
- **11.1 y 12.1 están en verde** porque son las dos raíces que no dependen de nada y
  que condicionan todo el backend: las tablas antes de cualquier consulta, y `libs/`
  antes de cualquier servicio Go.
- **15.1 y 16.1 están en ámbar**: se implementan completos, pero su despliegue queda
  bloqueado por el Requirement 19 hasta que exista el servicio de login.

Las mismas quince olas en el formato que exige el plan:

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "11.1", "12.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "12.2", "12.5"] },
    { "id": 2, "tasks": ["1.4", "3.1", "12.3", "12.4", "12.6", "12.7"] },
    { "id": 3, "tasks": ["4.1", "4.3", "8.1", "8.3", "13.1", "15.1", "16.1"] },
    { "id": 4, "tasks": ["4.2", "4.4", "4.5", "8.5", "13.2", "15.2", "16.2", "24.1"] },
    { "id": 5, "tasks": ["4.6", "4.7", "4.8", "8.7", "13.3", "13.5", "15.3", "16.3"] },
    { "id": 6, "tasks": ["6.1", "8.9", "8.11", "13.4", "13.6", "13.7", "15.4", "16.4"] },
    { "id": 7, "tasks": ["6.2", "9.1", "9.2", "13.8", "13.9", "14.1", "15.5", "16.5"] },
    {
      "id": 8,
      "tasks": [
        "6.3",
        "6.4",
        "6.5",
        "6.6",
        "8.2",
        "8.4",
        "8.6",
        "8.8",
        "8.10",
        "8.12",
        "9.3",
        "15.6"
      ]
    },
    { "id": 9, "tasks": ["7.1", "18.1", "18.2", "18.3", "18.4", "18.5", "18.6"] },
    { "id": 10, "tasks": ["7.2", "7.3", "18.7", "18.8", "19.1"] },
    { "id": 11, "tasks": ["19.2", "19.3", "20.1", "21.1", "23.1"] },
    { "id": 12, "tasks": ["20.2", "21.3", "22.1", "23.2"] },
    { "id": 13, "tasks": ["20.3", "20.4", "20.5", "21.2", "22.2", "23.3", "23.5"] },
    { "id": 14, "tasks": ["23.4", "25.1", "25.2", "25.3", "25.4"] }
  ]
}
```
