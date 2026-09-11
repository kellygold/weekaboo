import { RefreshCw } from 'lucide-react';

/** Shared footer status for browser, Android, iOS/iPadOS and desktop shells. */
export function CalendarRefresh({ loading, status, refresh }: { loading: boolean; status: string; refresh: () => void }) {
  return <span className="calendar-refresh" data-loading={loading}>
    <button className="refresh-calendars" aria-label="Refresh calendars" title={loading ? 'Refreshing calendars…' : 'Refresh calendars'} disabled={loading} onClick={refresh}>
      <RefreshCw size={14} aria-hidden="true" />
    </button>
    <span role="status" aria-live="polite" aria-atomic="true">{loading ? 'Refreshing calendars…' : status}</span>
  </span>;
}
