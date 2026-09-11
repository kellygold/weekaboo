import type { CalendarEvent } from '../domain';
import type { Account, AccountService, CalendarService, ConnectAccount } from '../services/contracts';
import { ServiceError } from '../services/errors';
import { AuthorizationError } from '../platform/authorization';
import type { ProviderId } from '../services/contracts';
import type { ProviderConnection } from './connections';
import type { DocumentStore, ProviderAccount, ProviderReader } from './state';
import { CalendarStateStore, identity } from './state';
import { OperationJournal, type EventOperationInput } from './operations';
import { splitEventTarget } from './writes';

/** Shared coordination; provider capabilities control which writes are exposed. */
export function standaloneServices(options: {
  providers: Partial<Record<ProviderId, ProviderConnection>>;
  documents: DocumentStore;
  availability: AccountService['availability'];
  setupInfo?: AccountService['setupInfo'];
  cancelAuthorization?: () => Promise<void>;
}): { accounts: AccountService; calendars: CalendarService } {
  const store = new CalendarStateStore(options.documents);
  const journal = new OperationJournal(options.documents);
  let activeConnection: { cancelled: boolean; committing: boolean } | undefined;
  let writeGeneration = 0;
  let mutation: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = mutation.then(operation, operation); mutation = next.catch(() => undefined); return next;
  }
  function connection(provider: ProviderId) {
    const value = options.providers[provider];
    if (!value) throw new ServiceError('unsupported', 'This provider is not available on this installation yet.');
    return value;
  }
  function metadata(account: ProviderAccount): Account {
    return { id: account.id, provider: account.provider, email: account.email, status: account.status, needsAttention: account.needsAttention };
  }
  async function connect(request: ConnectAccount, attempt: { cancelled: boolean; committing: boolean }) {
    const existingAccounts = (await store.read()).accounts;
    if (attempt.cancelled) throw new AuthorizationError('cancelled', 'Connection cancelled. Your existing accounts are unchanged.');
    const prepared = await connection(request.provider).prepare(request, existingAccounts);
    const { account, calendars: discovered } = prepared;
    try {
    if (attempt.cancelled) throw new AuthorizationError('cancelled', 'Connection cancelled. Your existing accounts are unchanged.');
    // Once metadata commits, cancellation cannot safely undo this connection.
    attempt.committing = true;
    // Authentication and complete discovery succeed before a connected account is visible.
    await store.change(state => ({ ...state, accounts: [...state.accounts.filter(old => old.id !== account.id), account], calendars: [
      ...state.calendars.filter(old => old.calendar.accountId !== account.id),
      ...discovered.map(row => {
        const prior = state.calendars.find(old => old.calendar.id === row.calendar.id);
        return prior ? { ...row, calendar: { ...row.calendar, enabled: prior.calendar.enabled, scope: prior.calendar.scope, color: prior.calendar.color } } : row;
      }),
    ] }));
    } catch (error) { await prepared.rollback?.(); throw error; }
  }
  const accounts: AccountService = {
    async list() { return (await store.read()).accounts.map(metadata); },
    availability: options.availability,
    setupInfo: options.setupInfo,
    async connect(request) {
      if (activeConnection) throw new AuthorizationError('busy', 'Finish the current connection before starting another.');
      const attempt = { cancelled: false, committing: false };
      activeConnection = attempt;
      try { await serialize(async () => {
        if (attempt.cancelled) throw new AuthorizationError('cancelled', 'Connection cancelled. Your existing accounts are unchanged.');
        await connect(request, attempt);
      }); }
      finally { activeConnection = undefined; }
    },
    cancelConnection: options.cancelAuthorization ? async () => {
      if (!activeConnection || activeConnection.committing) return;
      activeConnection.cancelled = true;
      // Do not serialize cancellation behind the operation it must interrupt.
      await options.cancelAuthorization!();
    } : undefined,
    disconnect: id => serialize(async () => {
      const account = (await store.read()).accounts.find(item => item.id === id);
      if (!account) return;
      const pending = await journal.unresolved(id);
      if (pending.some(op => op.state !== 'prepared')) throw new ServiceError('conflict', 'This account has unresolved calendar changes. Resolve those changes before disconnecting.');
      for (const operation of pending) await journal.transition(operation.id, 'rejected', 'disconnected-before-send');
      // Remove cache before metadata, so a failed cleanup can be retried while the
      // account remains addressable. No provider event is deleted.
      await editCache(entries => entries.filter(entry => entry.accountId !== id));
      await connection(account.provider).forget(account);
      await store.change(state => ({ ...state, accounts: state.accounts.filter(item => item.id !== id), calendars: state.calendars.filter(item => item.calendar.accountId !== id) }));
    }),
  };
  interface CacheEntry { accountId: string; calendarId: string; start: string; end: string; events: CalendarEvent[] }
  async function cache() {
    const snapshot = await options.documents.read('event-cache');
    if (!snapshot.value) return { ...snapshot, entries: [] as CacheEntry[] };
    const value = JSON.parse(snapshot.value);
    if (value.version !== 1 || !Array.isArray(value.entries)) throw new ServiceError('unsupported', 'This event cache needs a newer Weekaboo version.');
    return { ...snapshot, entries: value.entries as CacheEntry[] };
  }
  async function editCache(transform: (entries: CacheEntry[]) => CacheEntry[]) {
    const snapshot = await cache();
    const entries = transform(snapshot.entries);
    let encoded = JSON.stringify({ version: 1, entries });
    // Leave headroom below the native 8M UTF-16-character document bound. Evict
    // oldest windows, including an individually oversized window, rather than
    // permanently wedging refresh once the cache fills. Live results still render.
    while (encoded.length > 6000000 && entries.length) {
      entries.shift(); encoded = JSON.stringify({ version: 1, entries });
    }
    if (!await options.documents.compareAndSet('event-cache', snapshot.revision, encoded)) throw new ServiceError('conflict', 'Calendar cache changed while syncing.');
  }
  // One complete-window fetch per request; never reconcile a partial paginated response.
  async function readEvents(range: { start: Date; end: Date }) {
    if (!Number.isFinite(+range.start) || !Number.isFinite(+range.end) || range.end <= range.start) throw new ServiceError('validation', 'Choose a valid calendar range.');
    const generation = writeGeneration;
    const state = await store.read(), result: CalendarEvent[] = [];
    let firstError: unknown;
    for (const account of state.accounts) {
      const selected = state.calendars.filter(row => row.calendar.accountId === account.id && row.calendar.enabled !== false);
      if (!selected.length) continue;
      try {
        const accessToken = await connection(account.provider).access(account);
        const fresh: CacheEntry[] = [];
        for (const calendar of selected) {
          const events = (await connection(account.provider).reader.events(accessToken, calendar, range)).map(event => ({ ...event, editable: Boolean(connection(account.provider).writer && calendar.calendar.writable && connection(account.provider).writer?.canEdit?.(event) !== false) }));
          fresh.push({ accountId: account.id, calendarId: calendar.calendar.id, start: range.start.toISOString(), end: range.end.toISOString(), events });
        }
        await serialize(async () => {
          if (generation !== writeGeneration) throw new ServiceError('conflict', 'The calendar changed during refresh. Refresh again to see the saved change.');
          if (!(await store.read()).accounts.some(item => item.id === account.id)) return;
          await editCache(entries => [...entries.filter(entry => !fresh.some(row => entry.calendarId === row.calendarId && entry.start === row.start && entry.end === row.end)), ...fresh].slice(-60));
        });
        result.push(...fresh.flatMap(entry => entry.events));
        await serialize(() => store.change(current => ({ ...current, accounts: current.accounts.map(item => item.id === account.id ? { ...item, status: 'active', needsAttention: false } : item) })));
      } catch (error) {
        firstError ??= error;
        const needsAuth = error instanceof AuthorizationError && ['interaction-required', 'denied'].includes(error.code) || error instanceof ServiceError && error.code === 'authentication';
        await serialize(() => store.change(current => ({ ...current, accounts: current.accounts.map(item => item.id === account.id ? { ...item, status: needsAuth ? 'needs_reauth' : 'sync_error', needsAttention: true } : item) })));
        for (const row of selected) {
          const cached = (await cache()).entries.filter(entry => entry.calendarId === row.calendar.id && entry.start <= range.start.toISOString() && entry.end >= range.end.toISOString()).at(-1);
          if (cached) result.push(...cached.events.filter(event => Date.parse(event.start) < +range.end && (Date.parse(event.end) > +range.start || event.start === event.end && Date.parse(event.start) >= +range.start)).map(event => ({ ...event, syncState: 'cached' })));
        }
      }
    }
    const current = await store.read();
    const visible = new Set(current.calendars.filter(row => row.calendar.enabled !== false).map(row => row.calendar.id));
    const deduped = [...new Map(result.filter(event => visible.has(event.calendarId)).map(event => [event.id, event])).values()];
    if (firstError && !deduped.length) throw firstError;
    return deduped;
  }
  async function context(calendarId: string) {
    const state = await store.read(), calendar = state.calendars.find(row => row.calendar.id === calendarId);
    const account = state.accounts.find(row => row.id === calendar?.calendar.accountId);
    if (!calendar || !account) throw new ServiceError('not-found', 'This calendar is no longer connected.');
    const provider = connection(account.provider);
    if (!provider.writer || !calendar.calendar.writable || calendar.calendar.enabled === false) throw new ServiceError('unsupported', 'Editing is not available for this calendar on this installation yet.');
    return { calendar, account, provider, writer: provider.writer };
  }
  async function perform(input: EventOperationInput) {
    const { account, calendar, provider, writer } = await context(input.kind === 'create' ? input.event.calendarId : input.calendarId);
    if (input.accountId !== account.id) throw new ServiceError('validation', 'The operation belongs to a different account.');
    const operation = await journal.prepare(input);
    if ((await journal.unresolved(account.id)).some(other => other.id !== operation.id && other.state !== 'prepared' && (other.input.kind === 'create' ? other.input.event.calendarId : other.input.calendarId) === calendar.calendar.id)) {
      if (operation.state === 'prepared') await journal.transition(operation.id, 'rejected', 'earlier-change-pending');
      throw new ServiceError('conflict', 'A previous change still needs checking. Open Connected calendars → Manage accounts to resolve it.');
    }
    async function confirmed() {
      // Persist cache invalidation BEFORE closing the intent. If either storage
      // operation fails, the sent intent survives and a retry reconciles it.
      writeGeneration++;
      await editCache(entries => entries.filter(entry => entry.calendarId !== calendar.calendar.id));
      await journal.transition(operation.id, 'confirmed');
      return { syncState: 'synced' };
    }
    const accessToken = await provider.access(account);
    if (operation.state !== 'prepared') {
      if (input.kind === 'create') {
        const found = await (writer.findCreated || writer.get)(accessToken, calendar, operation.remoteCreateId);
        if (found) return confirmed();
      } else {
        const { remoteId } = splitEventTarget(input.target);
        const found = await writer.get(accessToken, calendar, remoteId);
        if (input.kind === 'delete' && !found) return confirmed();
        if (input.kind === 'update' && found && Object.entries(input.changes).every(([key, value]) => {
          const actual = key === 'description' ? found.editableDescription ?? found.description : found[key as keyof CalendarEvent];
          if (key === 'start' || key === 'end') return Date.parse(String(actual)) === Date.parse(String(value));
          if (key === 'timezone') return actual === value;
          return (actual ?? null) === (value ?? null);
        })) return confirmed();
      }
      throw new ServiceError('uncertain', 'We still couldn’t confirm this change was saved. Please try checking again later.');
    }
    await journal.transition(operation.id, 'sent');
    writeGeneration++;
    try {
      if (input.kind === 'create') await writer.create(accessToken, calendar, operation.remoteCreateId, input.event);
      else {
        const { remoteId } = splitEventTarget(input.target);
        if (input.kind === 'update') await writer.update(accessToken, calendar, remoteId, input.target, input.changes);
        else await writer.remove(accessToken, calendar, remoteId, input.target);
      }
    } catch (error) {
      const safeRejection = error instanceof ServiceError && ['validation', 'unsupported', 'conflict', 'not-found', 'authentication', 'forbidden', 'rate-limit'].includes(error.code);
      await journal.transition(operation.id, safeRejection ? 'rejected' : 'uncertain', error instanceof ServiceError ? error.code : 'uncertain');
      throw error;
    }
    return confirmed();
  }
  const calendars: CalendarService = {
    async pendingWrites() {
      return (await journal.list()).filter(op => !['confirmed', 'rejected'].includes(op.state)).map(op => ({
        id: op.id, accountId: op.input.accountId, kind: op.input.kind,
        title: op.input.kind === 'create' ? op.input.event.title : op.input.kind === 'update' ? op.input.changes.title || 'Event change' : 'Event removal',
        sent: op.state !== 'prepared', createdAt: op.createdAt,
      }));
    },
    resolveWrite: (id, action) => serialize(async () => {
      const op = (await journal.list()).find(row => row.id === id);
      if (!op || ['confirmed', 'rejected'].includes(op.state)) return;
      if (action === 'dismiss') await journal.transition(id, 'rejected', 'user-dismissed');
      else await perform(op.input);
    }),
    async listCalendars() {
      const state = await store.read();
      return state.calendars.map(({ calendar }) => ({ ...calendar, writable: Boolean(calendar.writable && connection(calendar.provider as ProviderId).writer), syncError: state.accounts.find(account => account.id === calendar.accountId)?.needsAttention ? 'Calendar access needs attention. Cached events may be out of date.' : undefined }));
    },
    listEvents: readEvents,
    async getEvent(target) {
      const parsed = splitEventTarget(target), { calendar, account, provider, writer } = await context(parsed.calendarId);
      const event = await writer.get(await provider.access(account), calendar, parsed.remoteId);
      if (!event) throw new ServiceError('not-found', 'The event was removed elsewhere.');
      return event;
    },
    createEvent: event => serialize(async () => {
      const { account } = await context(event.calendarId);
      return perform({ kind: 'create', accountId: account.id, event });
    }),
    updateEvent: (target, changes) => serialize(async () => {
      const { calendarId } = splitEventTarget(target), { account } = await context(calendarId);
      return perform({ kind: 'update', accountId: account.id, calendarId, target, changes });
    }),
    deleteEvent: target => serialize(async () => {
      const { calendarId } = splitEventTarget(target), { account } = await context(calendarId);
      await perform({ kind: 'delete', accountId: account.id, calendarId, target });
    }),
    configure: (id, settings) => serialize(() => store.change(state => ({ ...state, calendars: state.calendars.map(row => row.calendar.id === id ? { ...row, calendar: { ...row.calendar, ...settings } } : row) }))),
    async refresh() {
      for (const account of (await store.read()).accounts) {
        const discovered = await connection(account.provider).reader.calendars(await connection(account.provider).access(account), account);
        await serialize(() => store.change(state => !state.accounts.some(item => item.id === account.id) ? state : ({ ...state, calendars: [...state.calendars.filter(row => row.calendar.accountId !== account.id), ...discovered.map(row => {
          const prior = state.calendars.find(old => old.calendar.id === row.calendar.id);
          return prior ? { ...row, calendar: { ...row.calendar, enabled: prior.calendar.enabled, color: prior.calendar.color, scope: prior.calendar.scope } } : row;
        })] })));
      }
    },
  };
  return { accounts, calendars };
}
