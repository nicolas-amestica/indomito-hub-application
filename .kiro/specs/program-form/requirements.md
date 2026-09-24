# Requirements Document

## Introduction

El **formulario de programa** es la vista de armado de programas de viaje de Indómito Hub. Un programa reúne los datos generales de la gira, su duración, la cantidad de pasajeros, la tripulación que acompaña al grupo y todos los servicios contratados con sus costos. Las fechas corresponden al contrato y no forman parte del programa. A partir de esos datos el formulario calcula de forma reactiva el costo total del programa en pesos chilenos, incluyendo la conversión de servicios cotizados en dólares y reales, un resguardo de tipo de cambio, la utilidad esperada y un recargo adicional.

Esta feature reemplaza el formulario equivalente del portal legacy (`portal_admin_ng_dev_pri_usw2`, módulo `app-admin-portal/program`), con un alcance deliberadamente más reducido: se eliminan los campos que hoy no aportan valor (colegio, curso, representante, declaración al S.I.I.), se elimina el cálculo de IVA y retención de honorarios (los precios ingresados ya los incluyen) y se rediseña el flujo de salida para que pase por una previsualización explícita antes de exportar o de guardar.

El repositorio principal de esta spec es `ind-hub-app` porque el grueso del trabajo es de interfaz y de cálculo reactivo en el cliente. El backend aporta el servicio de tipos de cambio, los catálogos, la gestión de favoritos y la maquetación del PDF de presupuesto, repartidos en tres microservicios Go independientes.

**La persistencia del programa queda fuera del alcance.** No existe `POST /programas` en esta spec. Eso tiene dos consecuencias que se aceptaron de forma explícita: los favoritos pasan a ser la única forma de guardar un programa, y lo único desplegable hoy es una calculadora sin capacidad de guardar. Ambas están detalladas en el Alcance.

### Alcance

**Dentro del alcance**

- Armado de un programa nuevo: formulario completo, cálculo reactivo y previsualización del detalle.
- Servicio de tipos de cambio USD/BRL a CLP consumido al abrir el formulario, con respaldo por indisponibilidad de la fuente externa.
- Endpoint de catálogos de plan, temporada y destino servido desde DynamoDB, que además entrega los parámetros de margen de la empresa y los desplazamientos de escenario del presupuesto.
- Tabla de resumen reactiva con el detalle de tripulación y servicios.
- Panel lateral de favoritos con guardar, seleccionar, visualizar y eliminar. **Es el único mecanismo de persistencia de la feature.**
- Exportación del detalle del programa a Excel.
- Exportación del presupuesto a PDF con hasta cuatro escenarios de pasajeros derivados del propio programa.
- Separación del backend en tres microservicios Go: `api-program`, `api-catalog` y `api-favorite`.

**Dos consecuencias aceptadas**

- **Los favoritos pasan a ser la única forma de guardar un programa.** Dejan de ser una comodidad para no reingresar datos y se vuelven el mecanismo de persistencia de la feature. Un programa que no se guarda como favorito se pierde al cerrar la pestaña.
- **Lo único desplegable hoy es una calculadora sin guardar.** Los favoritos son por usuario y necesitan el authorizer para aislar a un usuario de otro. Con el authorizer apagado, a `dev` solo llegan las tasas de cambio y los catálogos, así que el formulario desplegado calcula, previsualiza y exporta a Excel, pero no guarda nada.

**Despliegue por fases**

La feature se implementa completa, pero su despliegue a AWS queda dividido porque
el Lambda Authorizer compartido está desactivado hoy (`authorizerEnabled: false`
en infraestructura, `SHARED_AUTHORIZER_ENABLED = false` en el backend), lo que
obliga a declarar `public: true` todo endpoint que se despliegue.

| Fase | Endpoints                                        | Condición                                                                                |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1    | `GET /tasas-cambio`, `GET /catalogos`            | Se despliegan ya. Son de lectura, sin datos de negocio ni datos personales.              |
| 2    | `POST /programas:presupuesto`, CRUD de favoritos | Implementados y con tests, **despliegue bloqueado** hasta que el authorizer esté activo. |

Mientras la fase 2 esté bloqueada, el formulario se ejercita de punta a punta
contra el servidor local (`make dev`). El motivo está en el Requirement 19.

**Fuera del alcance**

- **Persistencia del programa**: `POST /programas`, listado, consulta y edición de programas ya creados.
- **Recálculo autoritativo de los totales en el backend** y el motor de cálculo en Go. El cálculo vive una sola vez, en TypeScript.
- **Creación idempotente** del programa, porque no hay creación.
- Flujo de estados del programa (confirmar, aprobar, rechazar, completar).
- Generación de contratos, gestión de pagos y cuotas.
- Colegio, curso, panel de representante y toggle de declaración al S.I.I.
- Precarga automática de servicios administrativos y autocomplete de ítems de costo desde el mantenedor.
- Cálculo de IVA de servicios y de retención de honorarios de tripulación.
- Guardado de borradores parciales del formulario.
- Cacheo de tipos de cambio para ahorrar llamadas a la fuente externa. El respaldo del Requirement 14 resuelve disponibilidad, no rendimiento.

## Repos Involucrados

| Repo                         | Alias          | Qué hace en esta feature                                                                                                                                                                                                                                            |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ind-hub-app-ngx-pri-gh`     | application    | **Repo principal.** Página del formulario, paneles, motor de cálculo reactivo, tabla resumen, diálogo de previsualización, panel de favoritos, exportación a Excel, store del programa y servicios HTTP. Es el único lugar donde vive el cálculo.                   |
| `ind-hub-api-gox-sls-pri-gh` | services       | Tres microservicios Go independientes: `api-program` (maquetación del PDF de presupuesto, scope `program`), `api-catalog` (catálogos y tipos de cambio, scope `configuration`) y `api-favorite` (CRUD de favoritos, scope `favorites`). Sin motor de cálculo en Go. |
| `ind-hub-inf-aws-sls-pri-gh` | infrastructure | Dos tablas DynamoDB nuevas: `catalogos` (catálogos, parámetros de margen y último snapshot de tasas) y `favoritos`. Política IAM mínima por servicio sobre su propia tabla. La tabla `programas` existente no se usa en esta spec. Scope de commit: `ddb`.          |
| `ind-hub-iam-tsx-sls-pri-gh` | authorizer     | Sin cambios en esta spec. Su ausencia condiciona el despliegue de los endpoints que requieren identidad, según el Requirement 19.                                                                                                                                   |
| `ind-hub-orc-aws-sls-pri-gh` | orchestrator   | Fragmento OpenAPI de los endpoints nuevos. Scope de commit: `docs`.                                                                                                                                                                                                 |

## Glossary

- **Programa**: entidad central de la feature. Gira de estudios con fechas, pasajeros, tripulación, servicios y costos. Identificador en código: `program`.
- **Tripulante** (`crew_member`): persona que acompaña al grupo durante el viaje (guía turístico, coordinador). Su costo se cobra por día.
- **Servicio** (`service`): ítem contratado que forma parte del costo del programa (hotel, transporte, entrada a una actividad). Tiene un tipo de cobro que define cómo se multiplica su precio unitario.
- **Tipo de cobro** (`charge_type`): regla que determina el multiplicador aplicado al precio unitario de un servicio. Valores: `fixed`, `per_passenger`, `per_passenger_night`, `per_day`, `per_passenger_day`.
- **Pasajero liberado** (`free_passenger`): pasajero que viaja sin pagar. Consume los servicios pero no participa en el reparto del precio por persona.
- **Pasajero pagante** (`paying_passenger`): resultado de `totalPassengers − freePassengers`, con mínimo 1.
- **Ítem pasajero-independiente**: tripulante, o servicio cuyo tipo de cobro es `fixed` o `per_day`. Su costo no varía con la cantidad de pasajeros.
- **Ítem pasajero-dependiente**: servicio cuyo tipo de cobro es `per_passenger`, `per_passenger_night` o `per_passenger_day`.
- **Tasa del día** (`daily_rate`): valor en CLP de una unidad de USD o de BRL, obtenido del backend al abrir el formulario.
- **Incremento de divisa** (`currency_increase`): monto absoluto en CLP que se **suma** a la tasa del día para obtener la tasa efectiva de conversión. Resguarda a la empresa frente a un alza del tipo de cambio entre la cotización y el pago real al proveedor.
- **Tasa efectiva** (`effective_rate`): `tasa del día + incremento de divisa`. Es la tasa con la que se convierte todo monto en divisa extranjera a CLP.
- **Neto** (`netCLP`): suma en CLP de todos los ítems (tripulación y servicios) convertidos con la tasa efectiva. Es el costo del programa antes de utilidad y recargo.
- **Utilidad** (`utility`): porcentaje sobre el neto que la empresa espera ganar con el programa, expresado en CLP.
- **Piso de utilidad** (`minUtilityRate`): porcentaje mínimo de utilidad que define la política de la empresa. El formulario advierte cuando la utilidad seleccionada queda por debajo, sin impedir continuar.
- **Recargo** (`recharge`): porcentaje adicional aplicado sobre neto más utilidad, expresado en CLP.
- **Snapshot de tipo de cambio** (`exchange_snapshot`): fecha y valores de USD y BRL con los que se calcula el programa. Se obtiene al abrir el formulario y no se persiste, porque el programa no se persiste.
- **Snapshot de respaldo** (`fallback_snapshot`): último snapshot válido que el backend obtuvo de la fuente externa y guardó. Se entrega, marcado como respaldo, cuando la fuente externa no responde.
- **Favorito** (`favorite`): contenido del formulario guardado con un nombre. En esta spec es el único mecanismo de persistencia del programa.
- **Escenario de presupuesto** (`budget_scenario`): recálculo completo del programa para una cantidad de pasajeros derivada de la del propio programa, usado en la exportación a PDF.
- **Desplazamiento de escenario** (`scenario_offset`): entero configurable en el catálogo que se suma a la cantidad de pasajeros del programa para derivar un escenario del presupuesto.
- **Catálogo** (`catalog`): conjunto de opciones de plan, temporada o destino que el backend sirve desde DynamoDB, junto con los parámetros de margen y los desplazamientos de escenario. Reemplaza las constantes del frontend del legacy.
- **`Program_Form`**: la página del formulario de programa en `ind-hub-app`.
- **`Calculation_Engine`**: el motor de cálculo reactivo del frontend que deriva montos, subtotales y totales a partir del estado del formulario. Es el único motor de cálculo de la feature.
- **`Summary_Table`**: la tabla de resumen que muestra el detalle de tripulación y servicios con sus montos.
- **`Preview_Dialog`**: el diálogo que muestra el detalle completo del programa para revisarlo antes de exportarlo a Excel, exportarlo a PDF o guardarlo como favorito.
- **`Favorites_Panel`**: el panel lateral derecho de favoritos.
- **`Excel_Exporter`**: el componente del frontend que genera el archivo `.xlsx` del detalle del programa.
- **`Program_Service`** (`api-program`): el microservicio Go que expone el `Budget_Pdf_Endpoint`.
- **`Catalog_Service`** (`api-catalog`): el microservicio Go que expone el `Catalog_Endpoint` y el `Exchange_Rate_Endpoint`.
- **`Favorites_Service`** (`api-favorite`): el microservicio Go que expone el `Favorites_Endpoint`.
- **`Exchange_Rate_Endpoint`**: el endpoint Go que expone los tipos de cambio USD/BRL a CLP.
- **`Catalog_Endpoint`**: el endpoint Go que expone los catálogos de plan, temporada y destino, los parámetros de margen y los desplazamientos de escenario.
- **`Favorites_Endpoint`**: el endpoint Go que gestiona los favoritos del usuario.
- **`Budget_Pdf_Endpoint`**: el endpoint Go que maqueta el PDF de presupuesto con los escenarios de pasajeros que recibe.

## Contrato de datos propuesto

Esta es la evolución del contrato que planteaste. Los cambios respecto de tu propuesta original están justificados en las notas que siguen.

```typescript
/** Tipo de cobro de un servicio. Define el multiplicador del precio unitario. */
type ChargeType =
  | 'fixed' // Valor único: precio fijo, independiente de pasajeros y días
  | 'per_passenger' // Valor una vez por pasajero
  | 'per_passenger_night' // Valor por pasajero por noche
  | 'per_day' // Valor por día, independiente de la cantidad de pasajeros
  | 'per_passenger_day'; // Valor por pasajero por día

/** Monedas soportadas por el cálculo del programa. */
type CurrencyCode = 'CLP' | 'USD' | 'BRL';

/** Referencia a una entidad de catálogo. */
interface CatalogRef {
  id: string;
  display: string;
}

/** Datos generales del programa. */
interface ProgramGeneral {
  name: string;
  description: string | null;
  plan: CatalogRef;
  season: CatalogRef;
  destination: CatalogRef;
  departureCity: string;
}

/** Duración y cantidades del programa. */
interface ProgramSchedule {
  totalDays: number; // editable; el programa no tiene fechas
  totalNights: number; // precargado como totalDays − 1, sobrescribible por el usuario
  totalPassengers: number;
  freePassengers: number;
  payingPassengers: number; // derivado: max(1, totalPassengers - freePassengers)
}

/** Parámetros de precio y resguardo de tipo de cambio. */
interface ProgramPricing {
  usdIncreaseCLP: number; // monto absoluto en CLP sumado a la tasa del USD
  brlIncreaseCLP: number; // monto absoluto en CLP sumado a la tasa del BRL
  utilityRate: number; // porcentaje, 0 a 100
  rechargeRate: number; // porcentaje, 0 a 100
  exchange: ExchangeSnapshot;
}

/** Tipos de cambio con los que se calcula el programa. */
interface ExchangeSnapshot {
  date: string; // ISO 8601, fecha informada por la fuente de tasas
  usdToClp: number;
  brlToClp: number;
  /** Verdadero cuando los valores provienen del último snapshot conocido y no de la fuente externa. */
  isFallback: boolean;
}

/** Tripulante del programa. Su costo siempre es dailyPrice × totalDays. */
interface CrewMember {
  name: string;
  documentId: string; // RUT chileno, DNI argentino o CPF brasileño
  dailyPrice: number;
  currency: CurrencyCode;
  baseAmount: number; // derivado: dailyPrice × totalDays, en su moneda
  amountCLP: number; // derivado: baseAmount × tasa efectiva
}

/** Servicio contratado del programa. */
interface ProgramService {
  name: string;
  chargeType: ChargeType;
  unitPrice: number;
  currency: CurrencyCode;
  baseAmount: number; // derivado según chargeType, en su moneda
  amountCLP: number; // derivado: baseAmount × tasa efectiva
}

/** Totales calculados del programa, todos en CLP. */
interface ProgramTotals {
  subtotalCLP: number; // suma de ítems en CLP
  subtotalUSD: number; // suma de ítems en USD, expresada en USD
  subtotalBRL: number; // suma de ítems en BRL, expresada en BRL
  netCLP: number; // neto: todo convertido a CLP
  utilityCLP: number;
  netWithUtilityCLP: number;
  netWithUtilityPerPassengerCLP: number;
  rechargeCLP: number;
  totalCLP: number;
  totalPerPassengerCLP: number;
}

/**
 * Programa completo. Es el objeto que el formulario construye para la
 * previsualización, la exportación y el contenido del favorito. No se envía a
 * ningún endpoint de persistencia, porque no existe.
 */
interface Program {
  generals: ProgramGeneral;
  schedule: ProgramSchedule;
  pricing: ProgramPricing;
  crews: CrewMember[];
  services: ProgramService[];
  totals: ProgramTotals;
}

/** Escenario del presupuesto. Se deriva de los pasajeros del propio programa. */
interface BudgetScenario {
  totalPassengers: number; // pasajeros del programa + desplazamiento, acotado a mínimo 1
  freePassengers: number; // derivado de la proporción de liberados del programa
  payingPassengers: number; // derivado: totalPassengers − freePassengers, mínimo 1
  pricePerPassengerCLP: number; // calculado por el Calculation_Engine
}

/** Valores por defecto de margen y piso de política, servidos por el catálogo. */
interface MarginDefaults {
  usdIncreaseCLP: number;
  brlIncreaseCLP: number;
  utilityRate: number;
  rechargeRate: number;
  minUtilityRate: number;
}

/** Parámetros de política de empresa que acompañan a los catálogos. */
interface CatalogSettings {
  /** Plan vigente que el formulario preselecciona. */
  defaultPlanId?: string;
  margin?: MarginDefaults;
  /** Desplazamientos de pasajeros del presupuesto. Por defecto [-10, -5, 0, 5]. */
  scenarioOffsets?: number[];
}
```

### Límites de los campos numéricos

Estos rangos son únicos para toda la feature: el formulario los aplica como
validadores y los endpoints que reciben contenido de programa revalidan los que
les corresponden. Una divergencia entre capas es un defecto.

| Campo                      | Mínimo | Máximo     | Paso | Nota                                  |
| -------------------------- | ------ | ---------- | ---- | ------------------------------------- |
| `totalDays`                | 1      | 100        | 1    | Editable por el usuario               |
| `totalNights`              | 0      | 100        | 1    | Precargado como `totalDays − 1`       |
| `totalPassengers`          | 1      | 100        | 1    |                                       |
| `freePassengers`           | 0      | 99         | 1    | Siempre menor que `totalPassengers`   |
| `usdIncreaseCLP`           | 0      | 200        | 5    |                                       |
| `brlIncreaseCLP`           | 0      | 40         | 5    | Ver justificación en el Requirement 4 |
| `utilityRate`              | 0      | 100        | 1    | Porcentaje                            |
| `rechargeRate`             | 0      | 100        | 1    | Porcentaje                            |
| `dailyPrice` / `unitPrice` | 0,01   | 99.999.999 | —    | Entero si la moneda es CLP            |

### Notas sobre los cambios al contrato

1. **`Total.iva` se elimina.** Confirmaste que los precios de servicios y tripulación ya vienen con IVA y retención incluidos, porque son los montos que el proveedor cobra a la empresa. Con eso desaparecen también el flag `exempt` por fila y el indicador "Pérdida de diferencia por IVA" del legacy.
2. **`Detail` pasa a llamarse `ProgramSchedule` y se divide.** Tu `Detail` mezclaba fechas y cantidades con parámetros de precio. Se separa en `ProgramSchedule` (cuándo y cuántos) y `ProgramPricing` (con qué reglas de precio), porque son dos conjuntos con ciclos de vida distintos: los primeros los define el cliente, los segundos los define la empresa.
3. **`dollarIncrease` y `realIncrease` pasan a `usdIncreaseCLP` y `brlIncreaseCLP`.** El sufijo `CLP` hace explícito que es un monto absoluto en pesos y no un porcentaje, que es justo la ambigüedad que detectamos en el ejemplo numérico.
4. **`expectedUtility` pasa a `utilityRate`, `recharge` a `rechargeRate`.** El sufijo `Rate` marca que son porcentajes, y así se distinguen de `utilityCLP` y `rechargeCLP`, que son los montos resultantes.
5. **`Exchange` pasa a `ExchangeSnapshot` con campos `usdToClp` y `brlToClp`.** El nombre anterior no decía la dirección de la conversión.
6. **El programa no contiene fechas.** `totalDays` expresa su duración y queda editable; las fechas de inicio y término pertenecen al contrato.
7. **`Crew.dni` pasa a `documentId`.** El campo acepta RUT chileno, DNI argentino y CPF brasileño, así que `dni` nombraba solo uno de los tres casos.
8. **`Service.type` pasa a `chargeType`.** `type` no decía nada; `chargeType` nombra exactamente lo que hace.
9. **Se agregan campos derivados explícitos** (`totalDays`, `payingPassengers`, `baseAmount`, `amountCLP`) porque son los montos que el usuario revisa en la previsualización y los que se exportan a Excel, así que un lector posterior puede auditar el cálculo sin reconstruirlo.
10. **`plan` y `season` pasan de `PlanRef`/`string` a `CatalogRef`.** Ambos son catálogos y conviene que compartan forma con `destination`.
11. **`ExchangeSnapshot` gana `isFallback`.** Sin esa marca, un snapshot de respaldo y uno del día son indistinguibles para el frontend, y la advertencia del Requirement 1 tendría que inferirse comparando fechas. La marca la pone quien sabe la verdad: el endpoint que intentó la consulta externa.
12. **Se agregan `MarginDefaults` y `CatalogSettings`.** Los parámetros de margen dejan de elegirse en blanco cada vez y pasan a ser política de empresa administrada en base de datos, junto con el piso de utilidad y los desplazamientos de escenario. Ver Requirements 4, 13 y 16.
13. **Se agrega `BudgetScenario`.** Los escenarios dejan de ser cuatro constantes y se derivan del programa, así que necesitan forma propia en el contrato: la cantidad de pasajeros del escenario, sus liberados, sus pagantes y el precio por persona que el frontend calcula y envía.

## Requirements

### Requirement 1: Apertura del formulario y carga de tipos de cambio

**User Story:** Como cotizador, quiero que el formulario cargue los tipos de cambio del día al abrirse, para que los costos en dólares y reales se conviertan con valores vigentes sin que yo tenga que consultarlos.

#### Acceptance Criteria

1. WHEN el usuario navega a la ruta del formulario, THE Program_Form SHALL mostrar el título "Programa" y la bajada "Completa el formulario para crear un nuevo programa de viajes."
2. WHEN el Program_Form termina de inicializarse, THE Program_Form SHALL solicitar los tipos de cambio al Exchange_Rate_Endpoint exactamente una vez.
3. WHILE la solicitud de tipos de cambio está en curso, THE Program_Form SHALL mostrar un indicador de carga en la zona de tipos de cambio.
4. WHEN el Exchange_Rate_Endpoint responde con éxito, THE Program_Form SHALL mostrar la fecha del snapshot, el valor de USD en CLP y el valor de BRL en CLP.
5. IF el Exchange_Rate_Endpoint responde con un error, THEN THE Program_Form SHALL mostrar un mensaje que indica que los tipos de cambio no se pudieron obtener y SHALL ofrecer una acción para reintentar la solicitud.
6. WHILE los tipos de cambio no están disponibles, THE Program_Form SHALL mantener deshabilitada la acción de previsualizar.
7. WHEN el Exchange_Rate_Endpoint responde con un snapshot marcado como respaldo, THE Program_Form SHALL mostrar de forma prominente que está trabajando con tasas de una fecha anterior, SHALL indicar esa fecha y SHALL permitir continuar con la cotización.
8. WHILE los tipos de cambio en uso provienen de un snapshot de respaldo, THE Program_Form SHALL mantener habilitadas las acciones de previsualizar, exportar y guardar favorito.
9. WHILE los tipos de cambio en uso provienen de un snapshot de respaldo, THE Program_Form SHALL ofrecer una acción para reintentar la obtención de las tasas del día.

> **Advertir, no bloquear.** Un snapshot de respaldo es una tasa real, solo que
> de una fecha anterior. Bloquear el formulario por eso convierte una caída de la
> fuente externa en una jornada sin cotizar, que es peor que cotizar con la tasa
> de ayer y saberlo. Por eso el criterio 7 obliga a que la advertencia sea
> prominente y a que diga la fecha: la decisión de continuar es del cotizador,
> pero tiene que ser informada. Los Requirements 9 y 10 repiten la advertencia en
> la tabla de resumen y en la previsualización, porque son las dos pantallas donde
> se mira el precio final y nadie está mirando la zona de divisas en ese momento.

### Requirement 2: Datos generales del programa

**User Story:** Como cotizador, quiero registrar los datos generales del programa, para identificarlo y asociarlo a un plan, temporada y destino.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer los campos nombre, descripción, plan, temporada, destino y ciudad de salida.
2. THE Program_Form SHALL marcar como obligatorios los campos nombre, plan, temporada, destino y ciudad de salida.
3. THE Program_Form SHALL aceptar el campo descripción vacío.
4. WHEN el usuario deja un campo obligatorio vacío después de haberlo enfocado, THE Program_Form SHALL mostrar un mensaje de validación bajo ese campo.
5. IF el nombre del programa tiene menos de 3 caracteres, THEN THE Program_Form SHALL mostrar un mensaje de validación que indica el largo mínimo requerido.
6. WHEN el Program_Form termina de inicializarse, THE Program_Form SHALL solicitar al Catalog_Endpoint los catálogos de plan, temporada y destino en una sola petición.
7. WHILE la solicitud de catálogos está en curso, THE Program_Form SHALL mantener deshabilitados los selectores de plan, temporada y destino.
8. IF el Catalog_Endpoint responde con un error, THEN THE Program_Form SHALL mostrar un mensaje que indica que los catálogos no se pudieron obtener y SHALL ofrecer una acción para reintentar la solicitud.
9. WHEN el Catalog_Endpoint entrega un plan por defecto que corresponde a una opción vigente, THE Program_Form SHALL preseleccionar ese plan sin marcar el control como modificado.
10. IF el Catalog_Endpoint no entrega un plan por defecto vigente, THEN THE Program_Form SHALL dejar el selector de plan sin selección y SHALL mantenerlo obligatorio.

### Requirement 3: Duración y cantidades del programa

**User Story:** Como cotizador, quiero definir los días, las noches de estadía y la cantidad de pasajeros del programa, para calcular los costos que dependen de esas cantidades sin confundir el programa con un contrato fechado.

#### Acceptance Criteria

1. THE Program_Form SHALL omitir las fechas de inicio y término porque pertenecen al contrato y no al programa.
2. THE Program_Form SHALL exponer los días totales como un campo entero editable.
3. THE Program_Form SHALL aceptar entre 1 y 100 días totales.
4. THE Program_Form SHALL exponer los campos noches de estadía, cantidad de pasajeros y pasajeros liberados como enteros.
5. THE Program_Form SHALL aceptar valores entre 0 y 100 para noches de estadía.
6. THE Program_Form SHALL aceptar valores entre 1 y 100 para cantidad de pasajeros.
7. THE Program_Form SHALL aceptar valores entre 0 y 99 para pasajeros liberados.
8. IF la cantidad de pasajeros liberados es mayor o igual que la cantidad de pasajeros, THEN THE Program_Form SHALL mostrar un mensaje de validación que indica que debe existir al menos un pasajero pagante.
9. WHEN cambia la cantidad de pasajeros o la cantidad de pasajeros liberados, THE Calculation_Engine SHALL calcular los pasajeros pagantes como el mayor entre 1 y la diferencia entre pasajeros y liberados.
10. IF los días totales quedan fuera del rango permitido, THEN THE Program_Form SHALL mostrar un mensaje de validación.
11. WHILE el usuario no ha modificado las noches de estadía, WHEN cambian los días totales, THE Program_Form SHALL precargar las noches de estadía como los días totales menos uno.
12. WHEN el usuario modifica las noches de estadía, THE Program_Form SHALL dejar de precargarlas ante cambios posteriores de los días totales.
13. WHILE las noches de estadía son mayores que los días totales, THE Program_Form SHALL mostrar una advertencia no bloqueante que indica la incoherencia entre ambas cantidades.
14. WHILE las noches de estadía son mayores que los días totales, THE Program_Form SHALL mantener habilitadas las acciones de previsualizar, exportar y guardar favorito.

> **Rango único.** El límite de 1 a 100 pasajeros es el mismo que documenta la
> tabla de límites del contrato de datos y el que aplica el formulario. Con la
> persistencia del programa fuera del alcance no hay una revalidación
> autoritativa de todos los campos en el backend; lo que sí se revalida es la
> forma de lo que recibe el Budget_Pdf_Endpoint (ver Requirement 18). No hay un
> rango distinto por capa.

> **Por qué las noches se precargan y se pueden sobrescribir.** En la enorme
> mayoría de los itinerarios las noches son los días menos uno, y dejar el campo
> en blanco obliga a calcular a mano un valor que el sistema ya conoce. Pero hay
> giras con bus nocturno donde el grupo duerme en ruta la primera noche, y ahí las
> noches igualan a los días. Por eso la precarga es un punto de partida y no una
> regla: el criterio 12 hace que una vez que el cotizador tomó la decisión, un
> ajuste posterior de las fechas no la descarte en silencio. El criterio 13
> mantiene visible la incoherencia sin impedir el caso legítimo.

### Requirement 4: Parámetros de resguardo de tipo de cambio, utilidad y recargo

**User Story:** Como cotizador, quiero fijar un incremento por cada divisa, un porcentaje de utilidad y un porcentaje de recargo, para resguardar el margen del programa frente a un alza del tipo de cambio y definir cuánto espera ganar la empresa.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer los campos incremento USD, incremento BRL, utilidad y recargo como campos obligatorios de selección.
2. THE Program_Form SHALL presentar el incremento USD como montos en CLP, en múltiplos de 5, desde 0 hasta 200.
3. THE Program_Form SHALL presentar el incremento BRL como montos en CLP, en múltiplos de 5, desde 0 hasta 40.
4. THE Program_Form SHALL presentar la utilidad y el recargo como porcentajes enteros entre 0 y 100.
5. THE Program_Form SHALL mostrar junto al incremento USD la tasa del día del USD en CLP, y junto al incremento BRL la tasa del día del BRL en CLP.
6. WHEN el usuario selecciona un incremento de divisa, THE Calculation_Engine SHALL calcular la tasa efectiva de esa divisa como la suma de la tasa del día y el incremento seleccionado.
7. THE Calculation_Engine SHALL usar el valor 1 como tasa efectiva de CLP.
8. THE Program_Form SHALL mostrar la tasa efectiva resultante de cada divisa junto a su incremento.
9. THE Program_Form SHALL mostrar junto a cada incremento el porcentaje de resguardo que ese incremento representa sobre la tasa del día de esa divisa.
10. WHEN el Catalog_Endpoint responde con los valores por defecto de margen, THE Program_Form SHALL precargar el incremento USD, el incremento BRL, la utilidad y el recargo con esos valores.
11. IF el Catalog_Endpoint no entrega valores por defecto de margen, THEN THE Program_Form SHALL dejar esos cuatro campos sin selección y SHALL mantener su carácter obligatorio.
12. WHILE la utilidad seleccionada es menor que el piso de utilidad configurado, THE Program_Form SHALL mostrar una advertencia no bloqueante que indica el piso de política de la empresa.
13. WHILE la utilidad seleccionada es menor que el piso de utilidad configurado, THE Program_Form SHALL mantener habilitadas las acciones de previsualizar, exportar y guardar favorito.

> **Ejemplo trabajado.** Con la tasa del día del USD en 1.000 CLP y un incremento de 60 CLP, la tasa efectiva es 1.060 CLP por USD. Una noche de hotel de 40 USD aporta 40 × 1.060 = 42.400 CLP al neto del programa.

> **Por qué el BRL llega hasta 40 y el USD hasta 200.** El incremento es un monto
> absoluto en CLP, pero lo que resguarda es un porcentaje de la tasa. Con el USD
> alrededor de 950 CLP y el BRL alrededor de 170 CLP, el tope de 200 sobre el USD
> equivale a un resguardo del 21%, mientras que el mismo 200 sobre el BRL sería un
> 118%: un valor que ningún cotizador usaría y que solo sirve para equivocarse.
> El tope de 40 sobre el BRL da un 23%, comparable al del USD. El criterio 9
> muestra ese porcentaje en pantalla para que la escala sea evidente sin tener
> que calcularla mentalmente.

> **Por qué los parámetros de margen son política de empresa.** Elegir utilidad,
> recargo e incrementos en blanco cada vez tiene un modo de falla silencioso:
> dejar la utilidad en 0 por descuido produce un programa vendido al costo, y
> nada en la pantalla lo señala. Precargar los cuatro valores desde el catálogo
> convierte el caso normal en el caso por defecto, y el piso de utilidad hace
> visible la desviación cuando el cotizador baja el margen a propósito. La
> advertencia es no bloqueante porque hay negociaciones donde bajar el margen es
> la decisión correcta, y el sistema no está en posición de vetarla; su trabajo es
> que nadie lo haga sin darse cuenta. El criterio 11 preserva el comportamiento
> anterior como respaldo: si el catálogo no responde con parámetros, los campos
> siguen siendo obligatorios y se eligen a mano.

### Requirement 5: Tripulación del programa

**User Story:** Como cotizador, quiero registrar a los tripulantes que acompañan al grupo con su precio diario y moneda, para que su costo se incorpore al total del programa.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer una lista de tripulantes con al menos una fila.
2. THE Program_Form SHALL exponer por cada tripulante los campos nombre, documento de identidad, precio diario y moneda.
3. THE Program_Form SHALL marcar como obligatorios los cuatro campos de cada tripulante.
4. THE Program_Form SHALL ofrecer las monedas CLP, USD y BRL en el selector de moneda de cada tripulante.
5. WHEN el usuario activa la acción de agregar tripulante, THE Program_Form SHALL añadir una fila vacía al final de la lista.
6. WHEN el usuario activa la acción de eliminar tripulante, THE Program_Form SHALL quitar esa fila de la lista.
7. WHILE la lista de tripulantes tiene exactamente una fila, THE Program_Form SHALL mantener deshabilitada la acción de eliminar de esa fila.
8. THE Calculation_Engine SHALL calcular el monto base de cada tripulante como el producto de su precio diario por los días totales del programa.
9. IF el documento de identidad ingresado no corresponde a un RUT chileno, un DNI argentino ni un CPF brasileño válidos, THEN THE Program_Form SHALL mostrar un mensaje de validación en ese campo.
10. THE Program_Form SHALL aceptar valores entre 0,01 y 99.999.999 para el precio diario de un tripulante.
11. WHERE la moneda del tripulante es CLP, THE Program_Form SHALL aceptar únicamente valores enteros como precio diario.

### Requirement 6: Servicios del programa y tipos de cobro

**User Story:** Como cotizador, quiero registrar cada servicio con su tipo de cobro, para que el sistema aplique la fórmula correcta según si el servicio se cobra una vez, por noche, por día o de forma fija.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer una lista de servicios con al menos una fila.
2. THE Program_Form SHALL exponer por cada servicio los campos nombre, tipo de cobro, precio unitario y moneda.
3. THE Program_Form SHALL marcar como obligatorios los cuatro campos de cada servicio.
4. THE Program_Form SHALL ofrecer las monedas CLP, USD y BRL en el selector de moneda de cada servicio.
5. THE Program_Form SHALL ofrecer los cinco tipos de cobro con las etiquetas "Valor único", "Valor una vez por pasajero", "Valor por pasajero por noche", "Valor por día" y "Valor por pasajero por día".
6. WHERE el tipo de cobro es `fixed`, THE Calculation_Engine SHALL calcular el monto base del servicio como su precio unitario.
7. WHERE el tipo de cobro es `per_passenger`, THE Calculation_Engine SHALL calcular el monto base del servicio como el producto de su precio unitario por la cantidad de pasajeros.
8. WHERE el tipo de cobro es `per_passenger_night`, THE Calculation_Engine SHALL calcular el monto base del servicio como el producto de su precio unitario por la cantidad de pasajeros por las noches de estadía.
9. WHERE el tipo de cobro es `per_day`, THE Calculation_Engine SHALL calcular el monto base del servicio como el producto de su precio unitario por los días totales.
10. WHERE el tipo de cobro es `per_passenger_day`, THE Calculation_Engine SHALL calcular el monto base del servicio como el producto de su precio unitario por la cantidad de pasajeros por los días totales.
11. WHEN el usuario activa la acción de agregar servicio, THE Program_Form SHALL añadir una fila vacía al final de la lista.
12. WHEN el usuario activa la acción de duplicar un servicio, THE Program_Form SHALL añadir al final de la lista una fila con los mismos valores del servicio duplicado.
13. WHEN el usuario activa la acción de eliminar servicio, THE Program_Form SHALL quitar esa fila de la lista.
14. WHILE la lista de servicios tiene exactamente una fila, THE Program_Form SHALL mantener deshabilitada la acción de eliminar de esa fila.
15. THE Calculation_Engine SHALL usar la cantidad total de pasajeros, incluidos los liberados, como multiplicador de los tipos de cobro `per_passenger`, `per_passenger_night` y `per_passenger_day`.
16. THE Program_Form SHALL aceptar valores entre 0,01 y 99.999.999 para el precio unitario de un servicio.
17. WHERE la moneda del servicio es CLP, THE Program_Form SHALL aceptar únicamente valores enteros como precio unitario.
18. THE Program_Form SHALL aceptar como máximo 100 servicios y 20 tripulantes en un programa.

### Requirement 7: Conversión de montos a pesos chilenos

**User Story:** Como cotizador, quiero que los montos cotizados en dólares y reales se conviertan a pesos chilenos con la tasa efectiva, para ver el costo real del programa en la moneda en que la empresa vende.

#### Acceptance Criteria

1. THE Calculation_Engine SHALL calcular el monto en CLP de cada tripulante y de cada servicio como el producto de su monto base por la tasa efectiva de su moneda.
2. THE Calculation_Engine SHALL calcular el subtotal en CLP como la suma de los montos base de los ítems cuya moneda es CLP.
3. THE Calculation_Engine SHALL calcular el subtotal en USD como la suma de los montos base de los ítems cuya moneda es USD, expresado en USD.
4. THE Calculation_Engine SHALL calcular el subtotal en BRL como la suma de los montos base de los ítems cuya moneda es BRL, expresado en BRL.
5. THE Calculation_Engine SHALL calcular el neto del programa como la suma de los montos en CLP de todos los tripulantes y todos los servicios, redondeada al entero más cercano.

### Requirement 8: Cálculo de utilidad, recargo y total del programa

**User Story:** Como cotizador, quiero que el sistema calcule la utilidad y el recargo sobre el neto, para conocer el total que se cobrará al cliente y el precio por persona.

#### Acceptance Criteria

1. THE Calculation_Engine SHALL calcular la utilidad en CLP como el producto del neto sin redondear por el porcentaje de utilidad dividido por 100, redondeado hacia arriba al entero más cercano.
2. THE Calculation_Engine SHALL calcular el neto con utilidad como la suma del neto redondeado y la utilidad en CLP.
3. THE Calculation_Engine SHALL calcular el total del programa como el producto del neto con utilidad por la suma de 1 y el porcentaje de recargo dividido por 100, redondeado al entero más cercano.
4. THE Calculation_Engine SHALL calcular el recargo en CLP como la diferencia entre el total del programa y el neto con utilidad.
5. WHEN la cantidad de pasajeros liberados es 0, THE Calculation_Engine SHALL calcular el precio por persona de un monto como el cociente de ese monto por los pasajeros pagantes, redondeado hacia arriba al entero más cercano.
6. WHEN la cantidad de pasajeros liberados es mayor que 0, THE Calculation_Engine SHALL calcular el precio por persona de un monto repartiendo la porción del monto que corresponde a ítems pasajero-independientes entre la cantidad total de pasajeros y la porción restante entre los pasajeros pagantes, y SHALL redondear la suma de ambas porciones hacia arriba al entero más cercano.
7. THE Calculation_Engine SHALL determinar la porción pasajero-independiente de un monto como el producto de ese monto por el cociente entre la suma de los montos en CLP de los ítems pasajero-independientes y el neto sin redondear.
8. IF el neto sin redondear es 0, THEN THE Calculation_Engine SHALL calcular el precio por persona como el cociente del monto por los pasajeros pagantes, redondeado hacia arriba al entero más cercano.
9. THE Calculation_Engine SHALL exponer el precio por persona del neto con utilidad y el precio por persona del total del programa.
10. WHEN cambia cualquier campo que participa en el cálculo, THE Calculation_Engine SHALL recalcular todos los montos derivados antes del siguiente ciclo de renderizado.

> **Cambio respecto del legacy, validado el 14 de septiembre de 2026.** En el legacy la
> porción pasajero-independiente incluye únicamente los servicios de tipo "Valor único":
> la tripulación se reparte solo entre los pagantes, pese a que su costo es
> `precio diario × días totales` y por lo tanto tampoco depende de la cantidad de
> pasajeros. Los criterios 6 y 7 corrigen esa inconsistencia e incluyen en la porción
> pasajero-independiente a la tripulación y a los servicios de tipo `fixed` y `per_day`.
>
> **Efecto en el precio**: repartir esa porción entre todos los pasajeros y no solo entre
> los pagantes la abarata, así que el precio por persona **baja** respecto del legacy. En
> un programa donde la tripulación pesa un 15% del neto, con 30 pasajeros y 2 liberados,
> la diferencia es del orden del 1% del precio final. Es una rebaja, pero es un cambio de
> precio. El solicitante confirmó implementar la variante corregida: tripulación,
> `fixed` y `per_day` son pasajero-independientes.

### Requirement 9: Tabla de resumen reactiva

**User Story:** Como cotizador, quiero ver una tabla que se actualice a medida que ingreso datos, para validar los montos de cada ítem y el total del programa sin guardar nada.

#### Acceptance Criteria

1. WHILE la lista de tripulantes y la lista de servicios están ambas vacías de datos válidos, THE Summary_Table SHALL permanecer oculta.
2. WHEN existe al menos un tripulante o un servicio con datos válidos, THE Summary_Table SHALL mostrarse con una fila por cada tripulante y una fila por cada servicio.
3. THE Summary_Table SHALL mostrar por cada fila el nombre del ítem, su tipo, su moneda, su tasa efectiva, su precio unitario, su monto base y su monto en CLP.
4. THE Summary_Table SHALL mostrar un pie con el subtotal en CLP, el subtotal en USD, el subtotal en BRL, el neto, la utilidad, el neto con utilidad, el neto con utilidad por persona, el total del programa y el total por persona.
5. THE Summary_Table SHALL identificar el tipo de cada fila con una etiqueta visual distinta por tipo de cobro y una etiqueta propia para tripulación.
6. WHEN el usuario modifica cualquier campo que participa en el cálculo, THE Summary_Table SHALL reflejar el valor recalculado sin que el usuario ejecute ninguna acción adicional.
7. THE Summary_Table SHALL formatear todo monto en CLP con separador de miles y sin decimales, según la configuración regional de Chile.
8. THE Summary_Table SHALL mostrar la fecha del snapshot de tipo de cambio junto a los valores de USD y BRL usados en el cálculo.
9. THE Summary_Table SHALL ofrecer un campo de búsqueda que filtra las filas por coincidencia de texto en el nombre del ítem.
10. WHILE el campo de búsqueda tiene texto, THE Summary_Table SHALL calcular los montos del pie sobre el programa completo y no sobre las filas visibles.
11. WHILE el campo de búsqueda tiene texto, THE Summary_Table SHALL indicar cuántas filas se están mostrando del total de filas del programa.
12. WHILE los tipos de cambio en uso provienen de un snapshot de respaldo, THE Summary_Table SHALL mostrar de forma prominente que las tasas corresponden a una fecha anterior y SHALL indicar esa fecha.

> **Por qué el pie ignora el filtro.** El pie de la tabla es el costo del programa,
> no el de una selección de filas. Si el filtro afectara los totales, la pantalla
> mostraría dos cifras distintas llamadas "total" según el texto que quede escrito
> en el buscador, y basta con olvidar limpiarlo para cotizar con un monto
> incompleto. El buscador es una ayuda para encontrar una fila entre cien, no una
> herramienta de análisis parcial. El criterio 11 existe para que quede visible
> que hay filas ocultas.

### Requirement 10: Previsualización del programa

**User Story:** Como cotizador, quiero revisar el detalle completo del programa antes de exportarlo o guardarlo, para confirmar que los montos son correctos y no compartir un presupuesto con errores.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer una acción "Previsualizar" al pie del formulario.
2. WHILE el formulario tiene al menos un campo obligatorio inválido, THE Program_Form SHALL mantener deshabilitada la acción "Previsualizar".
3. WHEN el usuario activa la acción "Previsualizar", THE Preview_Dialog SHALL abrirse mostrando los datos generales, las fechas y cantidades, los parámetros de precio, el detalle de tripulación, el detalle de servicios y los totales del programa.
4. THE Preview_Dialog SHALL construir su contenido a partir del estado actual del formulario, sin solicitar datos al backend.
5. THE Preview_Dialog SHALL mostrar la fecha del snapshot de tipo de cambio y los valores de USD y BRL con los que se calcularon los montos.
6. WHILE los tipos de cambio en uso provienen de un snapshot de respaldo, THE Preview_Dialog SHALL mostrar de forma prominente que las tasas corresponden a una fecha anterior y SHALL indicar esa fecha.
7. THE Preview_Dialog SHALL exponer las acciones de exportar el detalle a Excel, exportar el presupuesto a PDF y guardar el programa como favorito.
8. THE Preview_Dialog SHALL exponer una acción "Cerrar" que cierra la previsualización y devuelve el foco al formulario, conservando todos los valores ingresados.
9. WHILE una exportación o un guardado iniciado desde el Preview_Dialog está en curso, THE Preview_Dialog SHALL mostrar un indicador de carga y SHALL mantener deshabilitadas sus acciones.
10. IF una acción iniciada desde el Preview_Dialog responde con un error, THEN THE Program_Form SHALL mantener el Preview_Dialog abierto, conservar todos los valores ingresados y mostrar un mensaje de error derivado del código de error de la respuesta.

> **Qué revisa la previsualización ahora.** Sin persistencia del programa, la
> previsualización deja de ser la antesala de una escritura y pasa a ser el único
> control humano sobre lo que sale de la aplicación: un archivo Excel, un PDF de
> presupuesto que llega a un colegio, o un favorito que se reutilizará después.
> Ese control es también la mitigación del riesgo que asume el Requirement 18, en
> el que el backend maqueta los precios que el frontend calcula sin recalcularlos.

### Requirement 11: Panel de favoritos

**User Story:** Como cotizador, quiero guardar el contenido de un programa como favorito y recuperarlo después, para conservar el trabajo hecho y no volver a ingresar desde cero los programas que armo con frecuencia.

#### Acceptance Criteria

1. THE Program_Form SHALL exponer una acción que abre y cierra el Favorites_Panel.
2. THE Favorites_Panel SHALL presentarse como un panel lateral anclado al borde derecho de la ventana.
3. WHERE el ancho de la ventana corresponde a un dispositivo de pantalla pequeña, THE Favorites_Panel SHALL presentarse superpuesto al contenido con una capa de fondo que lo cierra al ser activada.
4. WHERE el ancho de la ventana corresponde a un dispositivo de escritorio, THE Favorites_Panel SHALL exponer una acción que alterna entre el panel expandido y un riel de iconos colapsado.
5. WHEN el Favorites_Panel se abre, THE Favorites_Panel SHALL solicitar al Favorites_Endpoint los favoritos del usuario para el scope del programa.
6. THE Favorites_Panel SHALL exponer un campo de búsqueda que filtra los favoritos por coincidencia de texto en su nombre.
7. WHILE el usuario no tiene favoritos guardados para el scope del programa, THE Favorites_Panel SHALL mostrar un estado vacío que explica cómo guardar el primero.
8. THE Favorites_Panel SHALL exponer por cada favorito las acciones seleccionar, visualizar y eliminar.
9. WHEN el usuario activa la acción seleccionar de un favorito, THE Program_Form SHALL cargar el contenido de ese favorito en el formulario y THE Favorites_Panel SHALL cerrarse.
10. WHEN el Program_Form carga el contenido de un favorito, THE Calculation_Engine SHALL recalcular todos los montos con el snapshot de tipo de cambio vigente y no con el guardado en el favorito.
11. WHEN el usuario activa la acción visualizar de un favorito, THE Favorites_Panel SHALL mostrar el contenido de ese favorito en un diálogo de solo lectura.
12. WHEN el usuario activa la acción eliminar de un favorito, THE Favorites_Panel SHALL solicitar confirmación antes de enviar la eliminación al Favorites_Endpoint.
13. THE Program_Form SHALL exponer una acción de guardar favorito que solicita un nombre antes de enviar el contenido al Favorites_Endpoint.
14. WHILE el formulario tiene al menos un campo obligatorio inválido, THE Program_Form SHALL mantener deshabilitada la acción de guardar favorito.
15. WHEN el nombre ingresado coincide con el nombre del favorito actualmente seleccionado, THE Program_Form SHALL actualizar ese favorito en lugar de crear uno nuevo.
16. THE Favorites_Endpoint SHALL persistir por cada favorito los datos generales, las fechas y cantidades, los parámetros de precio, la lista de tripulantes y la lista de servicios del programa.
17. THE Favorites_Endpoint SHALL omitir de lo persistido los totales calculados y el snapshot de tipo de cambio.

> **Los favoritos son la persistencia.** Al quedar `POST /programas` fuera del
> alcance, un favorito ya no es una comodidad para no reingresar datos: es lo
> único que sobrevive al cierre de la pestaña. Eso eleva la importancia de los
> criterios 16 y 17: lo que no se guarde en el favorito se pierde, y lo que se
> guarde de más —en particular el snapshot de tipo de cambio— habilita el defecto
> de recotizar con una tasa vieja que el criterio 10 prohíbe.

### Requirement 12: Exportación del detalle a Excel

**User Story:** Como cotizador, quiero exportar el detalle del programa a Excel, para compartirlo y trabajarlo fuera de la aplicación.

#### Acceptance Criteria

1. WHILE la Summary_Table está visible, THE Program_Form SHALL exponer una acción de exportar a Excel.
2. WHEN el usuario activa la acción de exportar a Excel, THE Excel_Exporter SHALL generar un archivo `.xlsx` con una hoja que contiene una sección de encabezado, el detalle de todas las filas y una sección de resumen con los totales.
3. THE Excel_Exporter SHALL exportar todas las filas del programa, sin aplicar el filtro de búsqueda de la Summary_Table.
4. THE Excel_Exporter SHALL incluir en la sección de encabezado el nombre del programa, la fecha de exportación, la cantidad de pasajeros, la cantidad de pasajeros liberados, la tasa del día y la tasa efectiva de cada divisa.
5. THE Excel_Exporter SHALL nombrar el archivo con el nombre del programa en minúsculas y sus espacios reemplazados por guiones bajos.
6. WHILE una exportación está en curso, THE Program_Form SHALL mantener deshabilitadas todas las acciones de exportación.
7. IF la generación del archivo falla, THEN THE Program_Form SHALL mostrar un mensaje de error y SHALL habilitar nuevamente las acciones de exportación.
8. THE Excel_Exporter SHALL cargar su implementación de forma diferida, de modo que su peso no forme parte del paquete inicial de la aplicación.

### Requirement 13: Exportación del presupuesto a PDF con escenarios derivados

**User Story:** Como cotizador, quiero un PDF de presupuesto con el precio por persona para varios tamaños de grupo cercanos al de mi programa, para presentar alternativas al colegio sin armar cuatro programas distintos.

#### Acceptance Criteria

1. WHILE la Summary_Table está visible, THE Program_Form SHALL exponer una acción de exportar el presupuesto a PDF.
2. WHEN el usuario activa la acción de exportar el presupuesto a PDF, THE Calculation_Engine SHALL derivar un escenario por cada desplazamiento configurado, sumando ese desplazamiento a la cantidad de pasajeros del programa.
3. IF el Catalog_Endpoint no entrega desplazamientos de escenario, THEN THE Calculation_Engine SHALL usar los desplazamientos −10, −5, 0 y +5.
4. THE Calculation_Engine SHALL acotar la cantidad de pasajeros de cada escenario a un mínimo de 1.
5. THE Calculation_Engine SHALL calcular los pasajeros liberados de cada escenario como el producto de la cantidad de pasajeros de ese escenario por el cociente entre los pasajeros liberados y los pasajeros totales del programa, redondeado al entero más cercano.
6. THE Calculation_Engine SHALL acotar los pasajeros liberados de cada escenario a un máximo de la cantidad de pasajeros de ese escenario menos uno, de modo que todo escenario conserve al menos un pasajero pagante.
7. THE Calculation_Engine SHALL descartar todo escenario cuya cantidad de pasajeros y cantidad de pasajeros liberados coincidan con las de un escenario ya derivado.
8. THE Calculation_Engine SHALL recalcular en cada escenario los montos base de los servicios pasajero-dependientes con la cantidad de pasajeros de ese escenario.
9. THE Calculation_Engine SHALL calcular el precio por persona de cada escenario aplicando las mismas reglas de reparto del Requirement 8.
10. THE Program_Form SHALL enviar al Budget_Pdf_Endpoint el nombre del programa, el destino, la ciudad de salida, los días totales, las noches de estadía, la lista de nombres de servicios y, por cada escenario, su cantidad de pasajeros, sus pasajeros liberados, sus pasajeros pagantes y su precio por persona.
11. THE Program_Form SHALL enviar entre 1 y 4 escenarios al Budget_Pdf_Endpoint.
12. WHEN el Budget_Pdf_Endpoint responde con el documento, THE Program_Form SHALL descargar el archivo PDF en el dispositivo del usuario.
13. IF el destino del programa no está seleccionado, THEN THE Program_Form SHALL mostrar un mensaje que solicita seleccionar un destino y SHALL omitir la llamada al Budget_Pdf_Endpoint.
14. IF el Budget_Pdf_Endpoint responde con un error, THEN THE Program_Form SHALL mostrar un mensaje de error y SHALL habilitar nuevamente las acciones de exportación.

> **Por qué los escenarios se derivan del programa.** Los cuatro tamaños fijos de
> 20, 25, 30 y 35 pasajeros son útiles para una gira de 28 y completamente
> inútiles para una de 60: el PDF mostraría cuatro precios que no tienen relación
> con el grupo que se está cotizando. Derivarlos por desplazamiento mantiene los
> escenarios alrededor del programa real, y dejar los desplazamientos en el
> catálogo permite ajustar el abanico sin desplegar el frontend.
>
> **Por qué los liberados se derivan de la proporción del propio programa.** La
> cantidad de liberados es el resultado de una negociación: un cotizador que
> acordó 2 liberados en 30 pasajeros acordó, en la práctica, alrededor de un
> pasajero liberado cada quince. Aplicar esa proporción a cada escenario mantiene
> la condición negociada, mientras que una tabla fija de liberados por tramo
> impondría una condición que nadie acordó. El criterio 6 pone el límite obvio:
> ningún escenario puede quedarse sin alguien que pague.

### Requirement 14: Servicio de tipos de cambio en el backend

**User Story:** Como desarrollador del frontend, quiero un endpoint propio que entregue los tipos de cambio USD y BRL a CLP, para no depender de una API externa desde el navegador ni exponerme a restricciones de CORS.

#### Acceptance Criteria

1. WHEN el Exchange_Rate_Endpoint recibe una solicitud, THE Exchange_Rate_Endpoint SHALL consultar la fuente externa de tipos de cambio para USD y para BRL.
2. THE Exchange_Rate_Endpoint SHALL responder con la fecha informada por la fuente, el valor de USD en CLP, el valor de BRL en CLP y una marca que indica si los valores provienen de un snapshot de respaldo.
3. THE Exchange_Rate_Endpoint SHALL redondear los valores de USD en CLP y de BRL en CLP al entero más cercano.
4. WHEN el Exchange_Rate_Endpoint obtiene de la fuente externa un valor de USD en CLP y un valor de BRL en CLP, THE Exchange_Rate_Endpoint SHALL persistir esos valores y su fecha como último snapshot conocido.
5. WHEN el Exchange_Rate_Endpoint responde con valores obtenidos de la fuente externa, THE Exchange_Rate_Endpoint SHALL entregar la marca de respaldo desactivada.
6. IF una consulta a la fuente externa falla, THEN THE Exchange_Rate_Endpoint SHALL reintentar hasta 3 veces con espera creciente entre intentos.
7. IF la respuesta de la fuente externa no contiene el valor de USD en CLP o el valor de BRL en CLP, THEN THE Exchange_Rate_Endpoint SHALL tratar esa consulta como fallida.
8. IF los 3 reintentos fallan y existe un snapshot persistido, THEN THE Exchange_Rate_Endpoint SHALL responder con ese snapshot, con su fecha original y la marca de respaldo activada.
9. IF los 3 reintentos fallan y no existe ningún snapshot persistido, THEN THE Exchange_Rate_Endpoint SHALL responder con el código HTTP 502 y el código de error `UPSTREAM_SERVICE_ERROR`.
10. WHEN el Exchange_Rate_Endpoint responde con la marca de respaldo activada, THE Exchange_Rate_Endpoint SHALL registrar una advertencia en el log estructurado con la fecha del snapshot entregado.
11. THE Exchange_Rate_Endpoint SHALL aplicar un tiempo límite de 10 segundos a cada consulta a la fuente externa.
12. IF las fechas informadas por la fuente para USD y para BRL difieren, THEN THE Exchange_Rate_Endpoint SHALL registrar una advertencia en el log estructurado y SHALL usar la fecha informada para USD en la respuesta.

> **Respaldo por disponibilidad, no cacheo por rendimiento.** El snapshot
> persistido no existe para ahorrar llamadas a la fuente externa: la tasa se
> consulta igual en cada apertura del formulario, y ese cacheo se descartó a
> propósito porque introduce invalidación y riesgo de cotizar con una tasa vieja
> sin saberlo. Lo que resuelve el snapshot es otra cosa: hoy, una caída de
> jsDelivr deja el formulario inutilizable, porque sin tasas no hay conversión ni
> previsualización. Con el respaldo, esa caída degrada la precisión de la tasa y
> lo declara en pantalla, en vez de detener la operación. La diferencia con el
> cacheo está en la marca del criterio 2: acá el frontend siempre sabe si la tasa
> es de hoy o de antes, y el Requirement 1 obliga a decírselo al cotizador.

### Requirement 15: Estándares de interfaz y accesibilidad

**User Story:** Como usuario del portal, quiero que el formulario sea consistente con el resto de la aplicación y operable por teclado, para trabajar con eficiencia y sin depender del mouse.

#### Acceptance Criteria

1. THE Program_Form SHALL construir su interfaz con componentes de PrimeNG v22 y utilidades de TailwindCSS, sin hojas de estilo propias.
2. THE Program_Form SHALL organizar el contenido en paneles colapsables por sección: datos generales, fechas y cantidades, tripulación, servicios y resumen.
3. THE Program_Form SHALL permitir recorrer todos los campos y activar todas las acciones usando solo el teclado.
4. THE Program_Form SHALL asociar cada campo de entrada con una etiqueta visible.
5. THE Program_Form SHALL exponer un nombre accesible en cada control que se representa únicamente con un icono.
6. WHEN el Preview_Dialog se abre, THE Preview_Dialog SHALL mover el foco a su primer elemento interactivo y SHALL retener el foco dentro del diálogo mientras esté abierto.
7. WHEN el usuario presiona la tecla Escape con el Preview_Dialog abierto, THE Preview_Dialog SHALL cerrarse conservando los valores del formulario.
8. THE Program_Form SHALL mostrar todo texto visible en español con tildes.
9. THE Program_Form SHALL anunciar las advertencias no bloqueantes de piso de utilidad, de coherencia entre noches y días, y de tasas de respaldo, en una región que un lector de pantalla informe sin interrumpir la escritura.

### Requirement 16: Catálogos y parámetros de política de empresa

**User Story:** Como administrador, quiero que las opciones de plan, temporada y destino y los parámetros de margen se administren en base de datos, para agregar un destino nuevo o ajustar la política de precios sin esperar un despliegue del frontend.

#### Acceptance Criteria

1. WHEN el Catalog_Endpoint recibe una solicitud, THE Catalog_Endpoint SHALL responder con las opciones de plan, temporada y destino vigentes.
2. THE Catalog_Endpoint SHALL resolver la respuesta con una única consulta sobre la clave de partición.
3. THE Catalog_Endpoint SHALL exponer por cada opción su identificador, su etiqueta visible y su orden de presentación.
4. THE Catalog_Endpoint SHALL omitir de la respuesta las opciones marcadas como inactivas.
5. THE Catalog_Endpoint SHALL exponer por cada destino el identificador de la plantilla de presupuesto que le corresponde.
6. THE Catalog_Endpoint SHALL exponer los valores por defecto de incremento USD, incremento BRL, utilidad y recargo, y el piso mínimo de utilidad.
7. THE Catalog_Endpoint SHALL exponer los desplazamientos de escenario del presupuesto como una lista de enteros.
8. IF el catálogo no declara desplazamientos de escenario, THEN THE Catalog_Endpoint SHALL omitir ese campo de la respuesta.
9. IF el catálogo no declara valores por defecto de margen, THEN THE Catalog_Endpoint SHALL omitir ese campo de la respuesta.
10. THE Catalog_Endpoint SHALL responder con una cabecera de caché que permita al navegador reutilizar la respuesta durante 5 minutos.
11. THE Catalog_Endpoint SHALL exponer el identificador del plan vigente que el formulario debe preseleccionar.

> **Los respaldos del frontend son parte del contrato.** Cuando el catálogo omite
> los parámetros, el Requirement 4.11 deja los campos de margen sin selección y
> manteniéndose obligatorios, y el Requirement 13.3 aplica los desplazamientos por
> defecto. Una omisión en la base de datos degrada la comodidad, nunca la
> capacidad de cotizar.

> **Acoplamiento a vigilar.** El identificador de plantilla de un destino
> (`BRF`, `CBU`, y los que se agreguen) selecciona un generador de documento que
> vive en el código del backend. Un destino cargado en base de datos con un
> identificador de plantilla que nadie implementó produce un PDF fallido, no un
> PDF vacío. El Requirement 18 hace que ese caso falle con un mensaje claro en
> vez de con un error interno.

### Requirement 17: Separación del backend en microservicios

**User Story:** Como responsable del backend, quiero que los catálogos, los favoritos y el presupuesto vivan en microservicios separados, para que cada uno despliegue por su cuenta y tenga acceso únicamente a los datos que le corresponden.

#### Acceptance Criteria

1. THE Program_Service SHALL exponer únicamente el Budget_Pdf_Endpoint en el path `POST /programas:presupuesto`.
2. THE Catalog_Service SHALL exponer el Catalog_Endpoint en el path `GET /catalogos` y el Exchange_Rate_Endpoint en el path `GET /tasas-cambio`.
3. THE Favorites_Service SHALL exponer el Favorites_Endpoint en los paths de listar, crear, actualizar y eliminar favoritos.
4. THE Program_Service, THE Catalog_Service y THE Favorites_Service SHALL declararse como módulos Go independientes, cada uno con su propio despliegue.
5. THE Favorites_Service SHALL importar los tipos de dominio `ProgramGeneral`, `CrewMember` y `ProgramService` desde la librería de dominio compartida del repositorio, y no desde el Program_Service.
6. THE Program_Service, THE Catalog_Service y THE Favorites_Service SHALL declarar dependencias de código únicamente sobre las librerías compartidas del repositorio y sobre módulos externos.
7. THE Catalog_Service SHALL persistir los catálogos, los parámetros de margen, los desplazamientos de escenario y el último snapshot de tipos de cambio en la tabla `catalogos`.
8. THE Favorites_Service SHALL persistir los favoritos en la tabla `favoritos`.
9. THE Program_Service SHALL operar sin acceso a ninguna tabla de DynamoDB.
10. THE Catalog_Service SHALL recibir permisos de DynamoDB únicamente sobre la tabla `catalogos`.
11. THE Favorites_Service SHALL recibir permisos de DynamoDB únicamente sobre la tabla `favoritos`.
12. THE Program_Service, THE Catalog_Service y THE Favorites_Service SHALL operar sin usar la tabla `programas`.

| Servicio Go    | Endpoints                             | Scope de commit |
| -------------- | ------------------------------------- | --------------- |
| `api-program`  | `POST /programas:presupuesto`         | `program`       |
| `api-catalog`  | `GET /catalogos`, `GET /tasas-cambio` | `configuration` |
| `api-favorite` | `GET·POST·PUT·DELETE /favoritos`      | `favorites`     |

> **Por qué las tasas de cambio viven en `api-catalog`.** Tanto los catálogos como
> las tasas son datos de referencia que el formulario carga al abrirse: llegan
> juntos, se leen juntos y ninguno pertenece al programa que se está armando.
> Además, el respaldo de tasas del Requirement 14 necesita una tabla donde
> guardar el último snapshot, y esa tabla es la misma que ya sirve los catálogos,
> así que separarlo obligaría a crear una segunda tabla y una segunda política
> IAM para un único ítem. **Esta ubicación queda como decisión revisable**: ver el
> punto abierto 4.

> **Por qué los tipos de dominio se comparten por librería y no por servicio.**
> `api-favorite` guarda contenido de programa, así que necesita las mismas
> estructuras que describe el contrato de datos. Importarlas desde `api-program`
> crearía una dependencia de código entre dos servicios que despliegan por
> separado: un cambio en el servicio del presupuesto obligaría a recompilar y
> desplegar el de favoritos. Con los tipos en `libs/domain/program`, los dos
> servicios dependen de la librería y ninguno del otro.

### Requirement 18: Generación del presupuesto en el backend

**User Story:** Como cotizador, quiero que el backend produzca el documento de presupuesto con el diseño del destino, para entregar al colegio un PDF presentable sin que la aplicación tenga que maquetarlo.

#### Acceptance Criteria

1. WHEN el Budget_Pdf_Endpoint recibe una solicitud válida, THE Budget_Pdf_Endpoint SHALL maquetar el documento usando los precios por escenario recibidos en el cuerpo.
2. THE Budget_Pdf_Endpoint SHALL responder con el documento PDF generado.
3. THE Budget_Pdf_Endpoint SHALL seleccionar la plantilla del documento a partir del identificador de plantilla del destino recibido.
4. IF el cuerpo de la solicitud omite un campo obligatorio, THEN THE Budget_Pdf_Endpoint SHALL responder con el código HTTP 400 y el código de error `REQUIRED_FIELD_MISSING`.
5. IF la cantidad de escenarios recibidos es menor que 1 o mayor que 4, THEN THE Budget_Pdf_Endpoint SHALL responder con el código HTTP 400 y el código de error `VALIDATION_ERROR`.
6. IF el precio por persona de algún escenario recibido es menor o igual que 0, THEN THE Budget_Pdf_Endpoint SHALL responder con el código HTTP 400 y el código de error `VALIDATION_ERROR`.
7. IF algún escenario recibido declara menos de un pasajero pagante, THEN THE Budget_Pdf_Endpoint SHALL responder con el código HTTP 400 y el código de error `VALIDATION_ERROR`.
8. IF el destino recibido no declara identificador de plantilla de presupuesto, o su identificador no corresponde a ninguna plantilla registrada en el backend, THEN THE Budget_Pdf_Endpoint SHALL responder con el código HTTP 400 y el código de error `VALIDATION_ERROR`.
9. THE Budget_Pdf_Endpoint SHALL registrar en el log estructurado el identificador de plantilla, la cantidad de escenarios y el tamaño del documento generado.

> **Un solo motor de cálculo, y el riesgo que eso implica.** El motor de cálculo
> en Go se elimina. Su justificación era ser la autoridad sobre el dinero que se
> persistía, y sin persistencia no hay autoridad que establecer: duplicar el
> cálculo en dos lenguajes solo dejaría dos implementaciones que hay que mantener
> sincronizadas para verificar un número que nadie va a guardar. El backend
> maqueta lo que recibe.
>
> **El riesgo asumido**: un defecto en el motor del frontend produce un PDF con
> precios equivocados, y el backend no lo detecta. El control es humano y está en
> el Requirement 10: el cotizador revisa el detalle completo en la
> previsualización antes de exportar. Es un control más débil que un recálculo
> autoritativo, y por eso los criterios 5 a 8 verifican al menos la forma de lo
> que llega: un precio negativo, un escenario sin pagantes o una cantidad
> imposible de escenarios se rechazan en vez de imprimirse. Cuando la
> persistencia del programa entre al alcance, el recálculo autoritativo vuelve a
> tener sentido y habrá que reevaluarlo.

### Requirement 19: Despliegue condicionado por el estado del authorizer

**User Story:** Como responsable del sistema, quiero que ningún endpoint que dependa de la identidad del usuario llegue a producción sin autorización, para no exponer los favoritos de los usuarios a cualquiera que conozca la URL.

#### Acceptance Criteria

1. THE Exchange_Rate_Endpoint SHALL declararse como endpoint público.
2. THE Catalog_Endpoint SHALL declararse como endpoint público.
3. THE Favorites_Endpoint y THE Budget_Pdf_Endpoint SHALL declararse como endpoints que requieren autorización.
4. WHILE el Lambda Authorizer compartido no esté activo en el API Gateway, THE Favorites_Endpoint y THE Budget_Pdf_Endpoint SHALL permanecer sin desplegar.
5. WHILE el Favorites_Endpoint y el Budget_Pdf_Endpoint no estén desplegados, THE Program_Form SHALL poder ejercitarse de punta a punta contra el servidor local del backend.
6. WHILE el Favorites_Endpoint no esté desplegado, THE Program_Form desplegado en dev SHALL operar como calculadora, con cálculo reactivo, previsualización y exportación a Excel, y sin capacidad de guardar.
7. WHILE el Favorites_Endpoint no esté desplegado, THE Program_Form desplegado en dev SHALL indicar al usuario que el guardado de favoritos no está disponible.
8. THE Favorites_Endpoint SHALL derivar el identificador del usuario del contexto que entrega el authorizer, y no de un valor enviado en el cuerpo o en una cabecera de la solicitud.

> **Riesgo que este requerimiento evita.** El Gateway compartido tiene hoy
> `authorizerEnabled: false`, lo que obliga a declarar `public: true` a todo
> endpoint que se despliegue. Publicar el CRUD de favoritos bajo esa condición
> permitiría a cualquiera leer o borrar los favoritos de otros usuarios con solo
> conocer la URL, y como los favoritos son el único mecanismo de persistencia de
> la feature, eso equivale a publicar el trabajo guardado de todo el equipo
> comercial. El allowlist de CORS del Gateway no protege de esto, porque CORS lo
> aplica el navegador y una petición desde `curl` lo ignora por completo; el
> throttle de 10 peticiones por segundo limita el volumen, no el acceso. El
> presupuesto en PDF se bloquea por una razón distinta: genera un documento
> comercial e invoca compute facturable. Por eso ambos se implementan y se
> prueban, pero no se despliegan hasta que exista el authorizer, que a su vez
> depende del servicio de login.

## Decisiones tomadas durante el levantamiento

| #   | Duda                                     | Resolución                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Semántica del incremento de divisa       | Monto absoluto en CLP que se suma a la tasa del día. El ejemplo numérico original tenía un error aritmético; el criterio correcto quedó en el Requirement 4.                                                                                                                                                                                     |
| 2   | Tratamiento de pasajeros liberados       | El costo de los servicios por pasajero usa el total de pasajeros; el precio por persona se divide entre los pagantes, salvo la porción pasajero-independiente que se divide entre todos.                                                                                                                                                         |
| 3   | Base de utilidad y recargo               | La utilidad se calcula sobre el neto; el recargo se calcula sobre neto más utilidad (compuesto).                                                                                                                                                                                                                                                 |
| 4   | IVA y retención de honorarios            | Los precios ingresados ya incluyen ambos conceptos. El resumen desglosa informativamente el IVA contenido en servicios (`19/119`) y la retención 2026 contenida en el total bruto de tripulación (`15,25%`), sin volver a sumarlos al total. No se reincorpora un flag de exención por fila.                                                     |
| 5   | Origen de los tipos de cambio            | Endpoint Go propio que replica el comportamiento del handler legacy: consulta la fuente externa, redondea y expone fecha y valores.                                                                                                                                                                                                              |
| 6   | Snapshot de tipo de cambio               | Se obtiene al abrir el formulario y se usa para todo el cálculo. Al cargar un favorito se usa el snapshot vigente, no uno guardado.                                                                                                                                                                                                              |
| 7   | Flujo de salida                          | Botón "Previsualizar" que abre un diálogo con el detalle renderizado en el frontend, y desde ahí las acciones de exportar y guardar como favorito. Sin borradores parciales.                                                                                                                                                                     |
| 8   | Alcance recortado del legacy             | Se mantienen destino, plan, temporada, ciudad de salida, favoritos, export Excel y export PDF de escenarios. Se descartan colegio, curso, representante, toggle S.I.I., precarga de servicios administrativos y autocomplete de ítems de costo.                                                                                                  |
| 9   | Catálogo de tipos de cobro               | Cinco tipos: `fixed`, `per_passenger`, `per_passenger_night`, `per_day` y `per_passenger_day`. La tripulación mantiene su regla fija de precio por día y no participa del catálogo.                                                                                                                                                              |
| 10  | Rango del incremento por divisa          | USD de 0 a 200 CLP, BRL de 0 a 40 CLP. El incremento es un monto absoluto pero resguarda un porcentaje, y las dos tasas difieren en un orden de magnitud. Ver Requirement 4.                                                                                                                                                                     |
| 11  | Rangos numéricos únicos                  | Una sola tabla de límites en el contrato de datos, aplicada por el formulario y revalidada por los endpoints que reciben contenido de programa. Pasajeros de 1 a 100, precios desde 0,01 y enteros cuando la moneda es CLP.                                                                                                                      |
| 12  | Filtro de búsqueda de la tabla           | Filtra solo las filas visibles. El pie y la exportación a Excel siempre reflejan el programa completo. Ver Requirement 9.                                                                                                                                                                                                                        |
| 13  | Validación de totales en el backend      | **Revertida por la decisión 21.** El backend recalculaba los totales y rechazaba con `TOTALS_MISMATCH` una diferencia mayor a 1 CLP. Sin persistencia del programa no hay autoridad que establecer, así que el cálculo queda una sola vez, en TypeScript.                                                                                        |
| 14  | Idempotencia de la creación              | **Revertida por la decisión 19.** La clave ULID por apertura del `Preview_Dialog` protegía la creación del programa. Sin `POST /programas` no hay creación que hacer idempotente.                                                                                                                                                                |
| 15  | Origen de los catálogos                  | Endpoint propio servido desde DynamoDB, según el principio 9 del charter. Ver Requirement 16.                                                                                                                                                                                                                                                    |
| 16  | Despliegue de endpoints con identidad    | Bloqueado hasta que el authorizer compartido esté activo. Solo se despliegan los endpoints de lectura. Ver Requirement 19.                                                                                                                                                                                                                       |
| 17  | Manejo de estado del formulario          | Typed Reactive Forms para la entrada y la validación, signals para el estado derivado y el estado asíncrono. Sin dependencias nuevas de manejo de estado.                                                                                                                                                                                        |
| 18  | Separación del backend en microservicios | Tres servicios Go independientes: `api-program` (presupuesto, scope `program`), `api-catalog` (catálogos y tasas, scope `configuration`) y `api-favorite` (favoritos, scope `favorites`). Una tabla DynamoDB por servicio, política IAM mínima sobre la propia, tipos de dominio compartidos por librería. Ver Requirement 17.                   |
| 19  | Persistencia del programa                | Fuera del alcance. Se eliminan `POST /programas`, la clave de idempotencia, `TOTALS_MISMATCH` y el diálogo de confirmación. Los favoritos pasan a ser la única forma de guardar un programa, y lo desplegable hoy es una calculadora sin guardar. Ver Requirements 10, 11 y 19, y el punto abierto 5.                                            |
| 20  | Mejoras aprobadas al formulario          | Cuatro: parámetros de margen precargados desde el catálogo con piso de utilidad advertido (Requirement 4), respaldo de tasas por indisponibilidad de la fuente (Requirements 1, 9 y 14), noches de estadía precargadas y sobrescribibles (Requirement 3), y escenarios del presupuesto derivados de los pasajeros del programa (Requirement 13). |
| 21  | Un solo motor de cálculo                 | El motor en Go se elimina, junto con los vectores de cálculo compartidos, su script de sincronía y el anclaje de versión entre motores. El `Budget_Pdf_Endpoint` maqueta los precios que recibe y valida su forma. El riesgo asumido y su control humano están en el Requirement 18.                                                             |
| 22  | Porción pasajero-independiente           | Validada por el solicitante el 14 de septiembre de 2026: incluye tripulación y servicios `fixed` y `per_day`, aceptando la rebaja respecto del legacy.                                                                                                                                                                                           |

## Puntos abiertos

El punto 1, **porción pasajero-independiente**, quedó resuelto el 14 de septiembre de 2026 con la decisión 22.

2. **Servicio de login.** El Requirement 19 bloquea el despliegue del CRUD de favoritos y del presupuesto hasta que exista el authorizer, que a su vez depende del servicio de login (`services/api-auth`, aún sin crear). Esa dependencia está fuera del alcance de esta spec y necesita su propia planificación. Mientras siga abierta, lo desplegable es una calculadora sin guardar.
3. **Carga inicial de los catálogos y de los parámetros.** El Requirement 16 define cómo se leen los catálogos, los valores por defecto de margen, el piso de utilidad y los desplazamientos de escenario, pero no cómo se cargan sus datos iniciales en DynamoDB. Queda por definir si se resuelve con un script de siembra o con un endpoint de administración.
4. **Ubicación de `GET /tasas-cambio`.** Queda en `api-catalog` porque catálogos y tasas son ambos datos de referencia que el formulario carga al abrirse, y porque el snapshot de respaldo se guarda en la misma tabla que sirve los catálogos. **Es una decisión revisable**: la alternativa es un `api-exchange` propio, con su tabla y su política IAM, que separa la fuente externa del resto de los datos de referencia a cambio de un servicio más que operar. Ver Requirement 17.
5. **Persistencia del programa.** `POST /programas`, el listado y la edición quedan para una spec futura. Ahí se diseñarán también el GSI y el TTL sobre la tabla `programas`, que esta spec deja de usar, y se reevaluará si el recálculo autoritativo de los totales en el backend vuelve al alcance.
