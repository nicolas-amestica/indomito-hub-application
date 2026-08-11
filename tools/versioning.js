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

if (!env) {
  console.error('❌ Error: No se especificó el entorno.');
  console.error('Uso: node tools/versioning.js <dev|prd> [--no-push]');
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
  console.error(`❌ Error: No se encontró un número de versión semántica (ej. 1.2.3) en la propiedad 'version' de ${filePath}.`);
  console.error("   Formato esperado: version: 'Texto opcional v1.2.3'");
  process.exit(1);
}

const currentVersion = match[1];
let [major, minor, patch] = currentVersion.split('.').map(Number);

let commits;
try {
  const latestTag = execSync('git describe --tags --abbrev=0', { cwd: projectRoot }).toString().trim();
  console.log(`ℹ️  Última etiqueta encontrada: ${latestTag}. Analizando commits desde entonces.`);
  commits = execSync(`git log ${latestTag}..HEAD --pretty=format:%s`, { cwd: projectRoot }).toString().trim();
} catch (e) {
  console.warn('⚠️ No se encontraron etiquetas de Git. Analizando todos los commits del proyecto.');
  commits = execSync('git log --pretty=format:%s', { cwd: projectRoot }).toString().trim();
}

if (!commits) {
  console.log('✅ No hay nuevos commits. La versión no ha cambiado.');
  process.exit(0);
}

let bumpType = 'patch';
const commitLines = commits.split('\n');
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

if (newVersion === currentVersion) {
  console.log(`✅ La versión calculada (${newVersion}) es la misma que la actual. No se requieren cambios.`);
  process.exit(0);
}

console.log(`⬆️  Versión anterior: ${currentVersion}`);
console.log(`🚀 Nueva versión: ${newVersion}`);

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

  const tagName = `v${newVersion}`;

  // Remote: por defecto 'origin', si no existe toma el primero disponible
  let remote = 'origin';
  try {
    const remotes = execSync('git remote', { cwd: projectRoot }).toString().trim().split('\n').filter(Boolean);
    if (remotes.length > 0) {
      remote = remotes.includes('origin') ? 'origin' : remotes[0];
    }
  } catch {
    // si falla, mantenemos 'origin'
  }

  // Tags: evitar conflictos
  const localTagExists = (() => {
    try {
      execSync(`git rev-parse -q --verify refs/tags/${tagName}`, { cwd: projectRoot, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  const remoteTagExists = (() => {
    try {
      const out = execSync(`git ls-remote --tags ${remote} ${tagName}`, { cwd: projectRoot }).toString().trim();
      return Boolean(out);
    } catch {
      return false;
    }
  })();

  if (remoteTagExists) {
    throw new Error(
      `El tag ${tagName} ya existe en el remoto '${remote}'. No se puede publicar la misma versión. Elige otra versión o borra ese tag remoto.`
    );
  }

  if (!localTagExists) {
    console.log(`🏷️  Creando etiqueta (anotada): ${tagName}`);
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { cwd: projectRoot });
  } else {
    console.log(`ℹ️  El tag local ${tagName} ya existe. Se reutilizará.`);
  }

  if (autoPush) {
    console.log(`📡 Subiendo cambios al remoto '${remote}'...`);
    execSync(`git push ${remote}`, { cwd: projectRoot, stdio: 'inherit' });

    console.log(`📡 Subiendo SOLO la etiqueta nueva (${tagName}) al remoto '${remote}'...`);
    execSync(`git push ${remote} ${tagName}`, { cwd: projectRoot, stdio: 'inherit' });
    console.log('✔️  Push completado.');
  } else {
    console.log('⚠️  --no-push detectado. Saltando el push automático.');
    console.log(`   Ejecuta manualmente "git push ${remote} && git push ${remote} ${tagName}" para publicar los cambios.`);
  }
} catch (error) {
  console.error(`❌ Error durante la automatización de Git:`, error.message);
  console.error('   Por favor, revisa el estado de tu repositorio. Puede que necesites resolverlo manualmente.');
  process.exit(1);
}

console.log('\n🎉 ¡Versionado y publicación completados!');
