import { NativeLifecycle } from './platform/native-lifecycle';
import { NativeFileExchange } from './platform/native-files';
import { createRoot } from 'react-dom/client';
import { App } from './main';
import { NativeTaskStore, NativeDocumentStore, NativeHttpTransport, NativeCredentialVault } from './platform/capacitor';
import { nativeRuntime } from './platform/native-runtime';
import { ServiceProvider } from './services/context';
import { createStandaloneApp } from './engine/app-services';

const transport = new NativeHttpTransport();
const { authorization, availability, setupInfo } = nativeRuntime(transport);
const services = createStandaloneApp({
  documents: new NativeDocumentStore(),
  transport, credentials: new NativeCredentialVault(),
  taskStore: new NativeTaskStore(), files: new NativeFileExchange(), lifecycle: new NativeLifecycle(),
  authorization, availability, setupInfo,
});
createRoot(document.getElementById('root')!).render(<ServiceProvider services={services}><App demo={false} /></ServiceProvider>);
