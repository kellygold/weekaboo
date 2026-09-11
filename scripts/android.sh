#!/bin/sh
# Local builds only: never install, deploy or upload to a store.
set -eu
cd "$(dirname "$0")/.."
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
  elif command -v java >/dev/null 2>&1; then
    : # Gradle will use the configured JVM.
  else
    echo 'Set JAVA_HOME to a JDK 21 installation.' >&2; exit 1
  fi
fi
if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
# Explicit first-clone dependency fetch; normal notice collection is offline.
if [ "${1:-debug}" = 'resolve' ]; then
  npm run build:native
  npx cap sync android
  android/gradlew -p android -I "$PWD/scripts/native-android-notices.gradle" :app:weekabooNativeNoticeGraph -PweekabooNoticesGraphOutput="$PWD/output/native-android-dependencies.json"
  exit 0
fi
if [ "${1:-debug}" = 'release' ]; then
  export WEEKABOO_SIGNING_DIRECTORY="${WEEKABOO_SIGNING_DIRECTORY:-$HOME/.config/weekaboo/signing}"
  if [ ! -f "$WEEKABOO_SIGNING_DIRECTORY/android-release.p12" ] || [ ! -f "$WEEKABOO_SIGNING_DIRECTORY/android-release.password" ]; then
    echo 'Provide the existing dedicated release keystore and password file. No key will be generated or replaced.' >&2
    exit 1
  fi
fi
npm run build:native
npx cap sync android
# Debug/local sync may carry an explicitly incomplete inventory; release and
# bundle preparation fail until native SDK acknowledgment review is complete.
case "${1:-debug}" in
  sync|debug) python3 scripts/native-android-notices.py --allow-incomplete ;;
  release|bundle) python3 scripts/native-android-notices.py ;;
esac
case "${1:-debug}" in
  sync) ;;
  debug) android/gradlew -p android assembleDebug ;;
  bundle) android/gradlew -p android bundleRelease ;;
  release) android/gradlew --no-daemon -p android assembleRelease bundleRelease ;;
  *) echo 'Usage: scripts/android.sh [resolve|sync|debug|bundle|release]' >&2; exit 1 ;;
esac
