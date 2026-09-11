// Retain the existing Android invocation; both platforms use the same guarded proof.
process.env.WEEKABOO_TEST_PLATFORM = 'android';
await import('./verify-native-live.mjs');
