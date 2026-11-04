#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly OUTPUT_DIR="$PROJECT_DIR/dist"
readonly SOURCE_APK="$PROJECT_DIR/app/build/outputs/apk/debug/app-debug.apk"
readonly OUTPUT_APK="$OUTPUT_DIR/indomito-hub-tv-debug.apk"

install_after_build=false

usage() {
  printf '%s\n' \
    'Uso: ./scripts/build-debug.sh [--install]' \
    '' \
    'Compila, valida y copia el APK debug en dist/.' \
    'Con --install, además lo instala en el dispositivo ADB conectado.'
}

case "${1:-}" in
  '') ;;
  --install) install_after_build=true ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [[ -n "${ANDROID_HOME:-}" ]]; then
  sdk_root="$ANDROID_HOME"
elif [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
  sdk_root="$ANDROID_SDK_ROOT"
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
  sdk_root="$HOME/Library/Android/sdk"
elif [[ -d "$HOME/Android/Sdk" ]]; then
  sdk_root="$HOME/Android/Sdk"
else
  printf 'Error: no se encontró Android SDK. Define ANDROID_HOME.\n' >&2
  exit 1
fi

export ANDROID_HOME="$sdk_root"

if ! command -v java >/dev/null 2>&1; then
  printf 'Error: Java no está disponible en PATH. Se requiere JDK 17 o superior.\n' >&2
  exit 1
fi

java_version="$(java -version 2>&1 | head -n 1 | sed -E 's/.*version "([0-9]+).*/\1/')"
if [[ ! "$java_version" =~ ^[0-9]+$ ]] || ((java_version < 17)); then
  printf 'Error: se requiere JDK 17 o superior; versión detectada: %s.\n' "$java_version" >&2
  exit 1
fi

build_tools_dir="$(find "$sdk_root/build-tools" -mindepth 1 -maxdepth 1 -type d -print | sort -V | tail -n 1)"
if [[ -z "$build_tools_dir" ]]; then
  printf 'Error: no se encontraron Android SDK Build Tools.\n' >&2
  exit 1
fi

readonly AAPT="$build_tools_dir/aapt"
readonly APKSIGNER="$build_tools_dir/apksigner"
readonly ADB="$sdk_root/platform-tools/adb"

for required_tool in "$AAPT" "$APKSIGNER"; do
  if [[ ! -x "$required_tool" ]]; then
    printf 'Error: herramienta requerida no disponible: %s\n' "$required_tool" >&2
    exit 1
  fi
done

printf 'Android SDK: %s\n' "$sdk_root"
printf 'Build Tools: %s\n' "$(basename "$build_tools_dir")"
printf 'Java: %s\n' "$java_version"

cd "$PROJECT_DIR"
./gradlew clean lintDebug testDebugUnitTest assembleDebug

if [[ ! -f "$SOURCE_APK" ]]; then
  printf 'Error: Gradle terminó sin generar %s.\n' "$SOURCE_APK" >&2
  exit 1
fi

"$APKSIGNER" verify --verbose "$SOURCE_APK"
"$AAPT" dump badging "$SOURCE_APK" | grep -E \
  "^(package:|sdkVersion:|targetSdkVersion:|launchable-activity:|leanback-launchable-activity:)"

mkdir -p "$OUTPUT_DIR"
cp "$SOURCE_APK" "$OUTPUT_APK"

if command -v shasum >/dev/null 2>&1; then
  checksum="$(shasum -a 256 "$OUTPUT_APK" | awk '{print $1}')"
else
  checksum="$(sha256sum "$OUTPUT_APK" | awk '{print $1}')"
fi

printf '\nAPK generado: %s\n' "$OUTPUT_APK"
printf 'SHA-256: %s\n' "$checksum"

if [[ "$install_after_build" == true ]]; then
  if [[ ! -x "$ADB" ]]; then
    printf 'Error: ADB no está disponible en %s.\n' "$ADB" >&2
    exit 1
  fi

  connected_devices="$($ADB devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
  if [[ "$connected_devices" -ne 1 ]]; then
    printf 'Error: --install requiere exactamente un dispositivo ADB conectado; detectados: %s.\n' \
      "$connected_devices" >&2
    exit 1
  fi

  "$ADB" install -r "$OUTPUT_APK"
  "$ADB" shell monkey -p cl.girasindomito.hub.tv 1
fi
