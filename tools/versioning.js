import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// --- Configuracion ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');

const envFileMap = {
  dev: 'src/environments/environment.dev.ts',
  prd: 'src/environments/environment.production.ts',
};

// --- Logica del script ---

const env = process.argv[2];
const autoPush = !process.argv.includes('--no-push');
const dryRun = process.argv.includes('--dry-run');

if (!env) {
  console.error('❌ Error: No se especificó el entorno.');
  console.error('Uso: node tools/versioning.js <dev|prd> [--no-push] [--dry-run]');
  process.exit(1);
}

const filePathRelative = envFileMap[env];
if (!filePathRelative) {
  console.error(`❌ Error: Entorno inválido '${env}'. Usa 'dev' o 'prd'.`);
  process.exit(1);
}

const filePath = path.join(projectRoot, filePathRelative);

if (!fs.existsSync(filePath)) {
  console.error(`❌ Error: El archivo de entorno no se encontró en ${filePath}`);
  process.exit(1);
}

console.log(`🔄 Procesando el entorno '${env}' en el archivo: ${filePathRelative}`);

let fileContent;
try {
  fileContent = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  console.error(`❌ Error al leer el archivo ${filePath}:`, error);
  process.exit(1);
}

const versionRegex = /version: '[^']*?v?(\d+\.\d+\.\d+)'/;
const match = fileContent.match(versionRegex);

if (!match || !match[1]) {
  console.error(
    `❌ Error: No se encontró un número de versión semántica (ej. 1.2.3) en la propiedad 'version' de ${filePath}.`,
  );
  console.error("   Formato esperado: version: 'Texto opcional v1.2.3'");
  process.exit(1);
}

const currentVersion = match[1];
let [major, minor, patch] = currentVersion.split('.').map(Number);

let commits;
let releaseRef;
try {
  const latestEnvironmentTag = execSync(`git tag --list "${env}-v*" --sort=-v:refname`, {
    cwd: projectRoot,
  })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)[0];

  if (latestEnvironmentTag) {
    releaseRef = latestEnvironmentTag;
    console.log(
      `ℹ️  Última etiqueta de ${env} encontrada: ${latestEnvironmentTag}. Analizando commits desde entonces.`,
    );
  } else {
    releaseRef = execSync(
      `git log -1 --format=%H --grep="^chore(release): actualizar version a .* para ${env}$"`,
      { cwd: projectRoot },
    )
      .toString()
      .trim();
    if (releaseRef) {
      console.log(
        `ℹ️  Aún no hay etiquetas separadas para ${env}. Analizando desde su último commit de release.`,
      );
    }
  }

  commits = releaseRef
    ? execSync(`git log ${releaseRef}..HEAD --pretty=format:%s`, { cwd: projectRoot })
        .toString()
        .trim()
    : execSync('git log --pretty=format:%s', { cwd: projectRoot }).toString().trim();
} catch {
  console.warn(`⚠️ No se encontró un release anterior de ${env}. Analizando todos los commits.`);
  commits = execSync('git log --pretty=format:%s', { cwd: projectRoot }).toString().trim();
}

const commitLines = commits
  .split('\n')
  .filter(Boolean)
  .filter((commit) => !/^chore\(release\): actualizar version a .+ para (dev|prd)$/.test(commit));

if (commitLines.length === 0) {
  console.log('✅ No hay nuevos commits. La versión no ha cambiado.');
  process.exit(0);
}

let bumpType = 'patch';
console.log(`🔍 Analizando ${commitLines.length} commit(s)...`);

for (const commit of commitLines) {
  const lowerCommit = commit.toLowerCase();
  if (lowerCommit.includes('breaking change') || /^(feat|fix)(\(.+?\))?!:/.test(lowerCommit)) {
    bumpType = 'major';
    break;
  }
  if (/^feat(\(.+?\))?:/.test(lowerCommit)) {
    if (bumpType !== 'major') {
      bumpType = 'minor';
    }
  }
}

console.log(`📈 Tipo de incremento determinado: ${bumpType.toUpperCase()}`);

switch (bumpType) {
  case 'major':
    major++;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor++;
    patch = 0;
    break;
  case 'patch':
    patch++;
    break;
}

const newVersion = `${major}.${minor}.${patch}`;
const tagName = `${env}-v${newVersion}`;

if (newVersion === currentVersion) {
  console.log(
    `✅ La versión calculada (${newVersion}) es la misma que la actual. No se requieren cambios.`,
  );
  process.exit(0);
}

console.log(`⬆️  Versión anterior: ${currentVersion}`);
console.log(`🚀 Nueva versión: ${newVersion}`);

// Remote: por defecto 'origin', si no existe toma el primero disponible
let remote = 'origin';
try {
  const remotes = execSync('git remote', { cwd: projectRoot })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
  if (remotes.length > 0) {
    remote = remotes.includes('origin') ? 'origin' : remotes[0];
  }
} catch {
  // Si falla, se mantiene 'origin'.
}

// Validar antes de modificar archivos o crear commits.
const localTagExists = (() => {
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tagName}`, {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
})();

let remoteTagExists;
try {
  const out = execSync(`git ls-remote --tags ${remote} refs/tags/${tagName}`, {
    cwd: projectRoot,
  })
    .toString()
    .trim();
  remoteTagExists = Boolean(out);
} catch (error) {
  console.error(
    `❌ Error: No fue posible comprobar el tag ${tagName} en el remoto '${remote}'. No se modificó ningún archivo.`,
  );
  console.error(error.message);
  process.exit(1);
}

if (localTagExists || remoteTagExists) {
  console.error(
    `❌ Error: El tag ${tagName} ya existe${remoteTagExists ? ` en el remoto '${remote}'` : ' localmente'}. No se modificó ningún archivo.`,
  );
  process.exit(1);
}

if (dryRun) {
  console.log(
    `🧪 Simulación completada. Se usaría el tag ${tagName}; no se modificó ningún archivo.`,
  );
  process.exit(0);
}

const newFileContent = fileContent.replace(versionRegex, (original, oldVersion) => {
  return original.replace(oldVersion, newVersion);
});

try {
  fs.writeFileSync(filePath, newFileContent, 'utf8');
  console.log(`✔️  Archivo ${filePathRelative} actualizado correctamente.`);
} catch (error) {
  console.error(`❌ Error al escribir en el archivo ${filePath}:`, error);
  process.exit(1);
}

try {
  console.log('📦 Añadiendo cambios a Git...');
  execSync(`git add "${filePath}"`, { cwd: projectRoot });

  const commitMessage = `chore(release): actualizar version a ${newVersion} para ${env}`;
  console.log(`📝 Creando commit: "${commitMessage}"`);
  execSync(`git commit -m "${commitMessage}"`, { cwd: projectRoot });

  console.log(`🏷️  Creando etiqueta (anotada): ${tagName}`);
  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { cwd: projectRoot });

  if (autoPush) {
    console.log(`📡 Subiendo cambios al remoto '${remote}'...`);
    execSync(`git push ${remote}`, { cwd: projectRoot, stdio: 'inherit' });

    console.log(`📡 Subiendo SOLO la etiqueta nueva (${tagName}) al remoto '${remote}'...`);
    execSync(`git push ${remote} ${tagName}`, { cwd: projectRoot, stdio: 'inherit' });
    console.log('✔️  Push completado.');
  } else {
    console.log('⚠️  --no-push detectado. Saltando el push automático.');
    console.log(
      `   Ejecuta manualmente "git push ${remote} && git push ${remote} ${tagName}" para publicar los cambios.`,
    );
  }
} catch (error) {
  console.error(`❌ Error durante la automatización de Git:`, error.message);
  console.error(
    '   Por favor, revisa el estado de tu repositorio. Puede que necesites resolverlo manualmente.',
  );
  process.exit(1);
}

console.log('\n🎉 ¡Versionado y publicación completados!');
