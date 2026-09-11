// Read-only readiness check. Prints registration fingerprints, never credentials.
import { loadAuthConfig } from '../desktop/auth-config.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const properties = path => existsSync(path) ? Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(line => /^[A-Z_a-z][A-Z_a-z.]*\s*=/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
})) : {};
function run(command, args, env = process.env) { try { return execFileSync(command, args, { encoding: 'utf8', timeout: 15000, env, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { return null; } }
const bundle = 'app.weekaboo.calendar';
const java = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const keystore = resolve(homedir(), '.android/debug.keystore');
const key = existsSync(keystore) ? run(existsSync(java + '/bin/keytool') ? java + '/bin/keytool' : 'keytool', ['-list', '-v', '-alias', 'androiddebugkey', '-keystore', keystore, '-storepass', 'android', '-J-Duser.language=en']) : null;
const sha1 = key?.match(/SHA1:\s*([A-Fa-f0-9:]+)/)?.[1];
const signature = sha1 ? Buffer.from(sha1.replaceAll(':', ''), 'hex').toString('base64') : null;
const android = properties(resolve(root, 'android/native-auth.properties'));
const apple = properties(resolve(root, 'ios/native-auth.xcconfig'));
const google = apple.WEEKABOO_GOOGLE_CLIENT_ID || '';
const microsoft = apple.WEEKABOO_MICROSOFT_CLIENT_ID || '';
const uuid = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || '');
const developer = process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer';
const xcode = existsSync(developer) ? run('xcodebuild', ['-version'], { ...process.env, DEVELOPER_DIR: developer }) : null;
const sdk = process.env.ANDROID_HOME || resolve(homedir(), 'Library/Android/sdk');
const devices = run(resolve(sdk, 'platform-tools/adb'), ['devices']) || '';
const desktop = loadAuthConfig(resolve(root, 'desktop/native-auth.json'));
const report = {
  android: { package: bundle, debugSha1: sha1 || 'Build Android once to create its development identity', microsoftSignature: signature,
    microsoftRedirect: signature ? `msauth://${bundle}/${encodeURIComponent(signature)}` : null,
    localMicrosoftClientConfigured: Object.entries(android).some(([key, value]) => /client.?id/i.test(key) && uuid(value)),
    physicalDevicesAuthorized: devices.split('\n').filter(line => /\tdevice$/.test(line) && !line.startsWith('emulator-')).length,
    registrationProof: 'Not established by this check: register package/signature, then test actual Google/Microsoft consent.' },
  ios: { bundle, minimumOS: '17.0 (MSAL 2.15.0)', fullXcode: xcode || 'Install and launch full Xcode; Command Line Tools are insufficient',
    localGoogleClientConfigured: /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(google) && apple.WEEKABOO_GOOGLE_REVERSED_CLIENT_ID === google.split('.').reverse().join('.'),
    localMicrosoftClientConfigured: uuid(microsoft), microsoftRedirect: `msauth.${bundle}://auth`,
    registrationFile: 'ios/native-auth.xcconfig (copy the .example; public native client IDs only)',
    signing: 'Apple team, iOS profiles and device trust still require validation; Developer ID is for macOS.' },
  macos: { state: 'Electron foundation and ad-hoc arm64 package run. Google/Microsoft source and fixture tests implemented; live consent and notarization pending; existing Developer ID/hardened app launch and signed local DMG pass.', googleClientConfigured: Boolean(desktop.google), microsoftClientConfigured: Boolean(desktop.microsoft), microsoftRedirect: 'http://localhost', googleClientType: 'Desktop app', registrationFile: 'desktop/native-auth.json (installed-client registrations only, bundled into native app)' },
};
console.log(JSON.stringify(report, null, 2));
