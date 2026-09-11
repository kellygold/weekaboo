#!/bin/sh
# Local packaging only. No store upload, profile creation or certificate changes.
set -eu
cd "$(dirname "$0")/.."
node scripts/release-version.mjs
case "${1:-sync}" in
  sync) npm run build:native; npx cap sync ios; node scripts/native-ios-notices.mjs; exit 0 ;;
  simulator|resolve) ;;
  *) echo 'Usage: scripts/ios.sh [resolve|sync|simulator]' >&2; exit 1 ;;
esac
if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
if ! xcodebuild -version >/dev/null 2>&1; then
  echo 'Install and launch full Xcode, then retry. Command Line Tools alone cannot build the iOS app.' >&2; exit 1
fi
# Explicit first-clone dependency resolution. Normal sync/packaging never fetches
# dependencies implicitly for acknowledgment generation.
if [ "${1:-sync}" = resolve ]; then
  xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme Weekaboo -onlyUsePackageVersionsFromResolvedFile
  exit 0
fi
npm run build:native
npx cap sync ios
node scripts/native-ios-notices.mjs
xcodebuild -project ios/App/App.xcodeproj -scheme Weekaboo -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath output/ios-build CODE_SIGNING_ALLOWED=NO build
