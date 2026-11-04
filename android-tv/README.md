# Indómito Hub para Android TV

Aplicación nativa para Android TV y Google TV que abre `https://nuevo.admin.girasindomito.cl` dentro de una `WebView` en pantalla completa.

## Funcionalidad

- Launcher Leanback para aparecer en la pantalla de aplicaciones del televisor.
- Navegación mediante D-pad/control remoto y mouse, delegada al motor WebView.
- Cookies, almacenamiento DOM y base de datos Web habilitados para conservar la sesión.
- Navegación HTTPS dentro de la aplicación; esquemas externos se delegan a una aplicación compatible.
- Botón Back: vuelve al historial de WebView y cierra la aplicación cuando no existe una página anterior.
- Selector de archivos para controles HTML `input[type=file]`.
- Pantalla completa inmersiva y reproducción multimedia sin gesto táctil.
- Rechazo de HTTP sin cifrar, errores TLS y páginas marcadas por Safe Browsing.

## Requisitos

- JDK 17 o superior.
- Android SDK Platform 36.1 y Build Tools 36.0.0 o superior.
- ADB en el `PATH` para instalar en un dispositivo.

Si el SDK no está en la ubicación predeterminada, define `ANDROID_HOME` o agrega un archivo local no versionado `local.properties` con `sdk.dir=/ruta/al/sdk`.

## Compilar

### Script recomendado

Después de cada actualización, ejecuta desde la carpeta `android-tv/`:

```bash
./scripts/build-debug.sh
```

El script realiza el flujo completo:

1. Detecta y valida JDK 17+ y Android SDK.
2. Ejecuta compilación limpia, Lint y pruebas unitarias.
3. Genera y verifica la firma del APK debug.
4. Comprueba el package, SDK y launcher Leanback del manifiesto compilado.
5. Copia el resultado en una ruta estable y muestra su SHA-256.

Resultado:

```text
android-tv/dist/indomito-hub-tv-debug.apk
```

Para compilar, instalar sobre el dispositivo ADB conectado y abrir la aplicación:

```bash
./scripts/build-debug.sh --install
```

`--install` exige exactamente un dispositivo en estado `device`, evitando instalar accidentalmente en otro equipo.

### Compilación Gradle manual

```bash
cd android-tv
./gradlew assembleDebug
```

APK generado:

```text
android-tv/app/build/outputs/apk/debug/app-debug.apk
```

## Instalar mediante ADB

Activa las opciones de desarrollador y la depuración USB o por red en el televisor. Luego:

```bash
adb connect IP_DEL_TELEVISOR:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p cl.girasindomito.hub.tv 1
```

Para consultar registros:

```bash
adb logcat | grep -i 'chromium\|girasindomito'
```

## Autenticación

La autenticación ocurre en el sitio cargado y las cookies se guardan en el perfil WebView de la aplicación. No se copian credenciales ni tokens al código nativo. Cerrar la aplicación no elimina la sesión; borrar los datos de la aplicación sí lo hace.

## Limitaciones

- La experiencia D-pad depende de que los controles del sitio sean enfocables y mantengan un orden de foco coherente. La aplicación no modifica el DOM del portal.
- La compatibilidad web depende de la versión de Android System WebView/Chrome instalada en el televisor.
- Ventanas emergentes JavaScript no se habilitan. Los flujos de autenticación deben navegar en la misma ventana.
- No se implementan descargas nativas ni notificaciones push.
- Este proyecto genera un APK debug. Una distribución en Google Play requiere firma release, recursos gráficos finales, ficha de privacidad y validación en dispositivos físicos.
