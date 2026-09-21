<!-- AUTO-GENERATED — DO NOT EDIT MANUALLY -->
<!-- Managed-By: indomito-context-compiler -->
<!-- Artifact-Format: 1 -->
<!-- Engine-Version: 1.0.0 -->
<!-- Source: ai/source/repo-overrides/ind-hub-app.md -->
# Repo Rules — ind-hub-app

# Repo Override — ind-hub-app

> Contexto específico del frontend Angular de Indómito Hub.
> Este archivo se combina con el Global_Context para generar los adaptadores de agente.
> NO duplica reglas globales (idioma, commits, seguridad). Solo agrega contexto del repo.

## Descripción

Frontend de Indómito Hub. SPA Angular 22 para gestión de viajes educativos y giras de estudios.

## Stack

- Angular 22 (standalone components, signals, `inject()`)
- PrimeNG v22 para UI components
- TailwindCSS v4.3 para estilos
- PostCSS con `@tailwindcss/postcss` para compilar Tailwind
- TypeScript 5.x
- Vitest para testing

## Estructura (por definir)

```text
src/app/
├── auth/           — Autenticación, guards
├── shared/         — Componentes, interfaces, pipes, directivas
└── features/       — Features de la aplicación (viajes, pasajeros, cotizaciones)
```

## Reglas

- Standalone components + `ChangeDetectionStrategy.OnPush`
- Angular Signals para estado reactivo
- PrimeNG v22 para componentes de UI
- TailwindCSS v4.3 para layout y estilos; tokens y estilos base globales según el estándar visual
- Conservar `.postcssrc.json` y `@tailwindcss/postcss`; verificar que el CSS
  compilado no contenga directivas crudas `@tailwind` o `@apply`
- TSDoc en español para funciones públicas e interfaces
- Plantillas: `@if`, `@for`, `@switch`

## Scopes de Commits

`core`, `app-auth`, `accounting`, `analytics`, `assign-installment`, `shared`, `client`, `configuration`, `documents`, `help`, `home`, `inbox`, `informative-media`, `layout`, `meet`, `passenger`, `payment`, `payment-history`, `profile`, `program`, `ticket`, `tools`

## Diseño de formularios y páginas

Antes de crear o modificar UI, leer en el orquestador:
`docs/standards/frontend/design-system-usage.md` y
`docs/standards/frontend/ui-patterns.md` (rutas relativas a la raíz del orquestador).
Son obligatorios y prevalecen sobre sugerencias estéticas genéricas de skills.
Reutilizar `src/app/core/theme/indomito.preset.ts`, tokens de `src/styles.css`
y `src/app/shared/ui/page-header.component.ts`. Tomar el formulario de programas
como referencia visual. No inventar paletas, tipografías, radios ni estructuras
por feature. Registrar nuevas variantes en los estándares y comprobar build,
pruebas afectadas y comportamiento visual en móvil y escritorio.
