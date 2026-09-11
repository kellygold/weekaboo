import type { TaskStore } from '../domain';
import type { AccountService, AppServices } from '../services/contracts';
import type { AuthorizationPort } from '../platform/authorization';
import type { ActivityLifecycle, CredentialVault, FileExchange, HttpTransport } from '../platform/ports';
import type { DocumentStore } from './state';
import { LocalTaskService } from '../services/tasks';
import { standaloneServices } from './services';
import { oauthConnection, icloudConnection } from './connections';
import { ICloudCalDav } from './providers/caldav';
import { googleReader } from './providers/google';
import { googleWriter } from './providers/google-writes';
import { microsoftReader } from './providers/microsoft';
import { microsoftWriter } from './providers/microsoft-writes';
import { icloudWriter } from './providers/icloud-writes';

/** One provider/service assembly for installed runtimes. No React or SDK imports. */
export function createStandaloneApp(ports: {
  authorization: AuthorizationPort;
  availability: AccountService['availability'];
  setupInfo?: AccountService['setupInfo'];
  transport: HttpTransport;
  credentials: CredentialVault;
  documents: DocumentStore;
  taskStore: TaskStore;
  files: FileExchange;
  lifecycle: ActivityLifecycle;
}): AppServices {
  const { authorization, transport, credentials, documents, availability, setupInfo } = ports;
  const icloud = new ICloudCalDav(transport);
  const services = standaloneServices({ documents, availability, setupInfo, cancelAuthorization: authorization.cancel ? () => authorization.cancel!() : undefined, providers: {
    google: { ...oauthConnection('google', authorization, googleReader(transport)), writer: googleWriter(transport) },
    microsoft: { ...oauthConnection('microsoft', authorization, microsoftReader(transport)), writer: microsoftWriter(transport) },
    icloud: { ...icloudConnection(icloud, credentials), writer: icloudWriter(icloud) },
  } });
  return { ...services, tasks: new LocalTaskService(ports.taskStore), files: ports.files, lifecycle: ports.lifecycle };
}
