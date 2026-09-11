import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.weekaboo.calendar',
  appName: 'Weekaboo',
  webDir: 'dist-native',
  // Capacitor otherwise logs plugin arguments in debug builds, including credentials.
  loggingBehavior: 'none',
  // No server.url: installed assets must work with the development Mac off.
};
export default config;
