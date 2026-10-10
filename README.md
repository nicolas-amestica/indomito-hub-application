# IndHubAppNgxPriGh

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Despliegue automático DEV desde GitHub

El workflow `.github/workflows/deploy-dev.yml` ejecuta pruebas, compila DEV y publica la SPA en S3/CloudFront al actualizar `main`. AWS se autentica mediante OIDC y entrega credenciales temporales; no se guardan access keys en GitHub.

Configuración inicial, una sola vez:

```bash
aws cloudformation deploy \
  --profile pa-dev \
  --region us-east-1 \
  --stack-name ind-dev-hub-github-oidc \
  --template-file aws/github-actions-oidc-dev.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

Si la cuenta ya tiene el proveedor OIDC de GitHub, agrega:

```bash
--parameter-overrides \
  ExistingOidcProviderArn=arn:aws:iam::382670112717:oidc-provider/token.actions.githubusercontent.com
```

Obtén el rol creado:

```bash
aws cloudformation describe-stacks \
  --profile pa-dev \
  --region us-east-1 \
  --stack-name ind-dev-hub-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue" \
  --output text
```

Guarda ese ARN en GitHub → Settings → Secrets and variables → Actions → Variables, con el nombre `DEV_AWS_ROLE_ARN`. Desde ese momento, cada push a `main` despliega DEV automáticamente; también puede relanzarse con **Run workflow**.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
