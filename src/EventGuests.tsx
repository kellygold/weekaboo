import { Check, X, Clock, CircleHelp } from 'lucide-react';
import type { CalendarEvent } from './domain';

type Guest = NonNullable<CalendarEvent['attendees']>[number];
const groups = [
  { status: 'accepted', label: 'Going', Icon: Check },
  { status: 'tentative', label: 'Maybe', Icon: CircleHelp },
  { status: 'waiting', label: 'Awaiting reply', Icon: Clock },
  { status: 'declined', label: 'Declined', Icon: X },
];
const statusOf = (guest: Guest) => ['accepted', 'tentative', 'declined'].includes(guest.status) ? guest.status : 'waiting';
const initial = (guest: Guest) => (guest.name || guest.email || '?').slice(0, 1).toUpperCase();

export function EventGuests({ guests }: { guests: Guest[] }) {
  const sections = groups.map(group => ({ ...group, people: guests.filter(person => statusOf(person) === group.status) })).filter(group => group.people.length);
  const ordered = sections.flatMap(group => group.people);
  const going = guests.filter(person => person.status === 'accepted').length;
  const declined = guests.filter(person => person.status === 'declined').length;
  return <details className="detail-attendees">
    <summary><span className="attendee-stack" aria-hidden="true">{ordered.slice(0,4).map((person,i) => <span key={i} className={`attendee-avatar status-ring-${statusOf(person)}`}>{initial(person)}</span>)}</span><span>{guests.length} guests<small className="guest-response-summary"><span className="status-accepted">{going} going</span><span aria-hidden="true"> · </span><span className="status-declined">{declined} declined</span></small></span></summary>
    <div className="guest-groups">{sections.map(({ status, label, Icon, people }) => <section className={`guest-group guest-group-${status}`} aria-label={label} key={status}>
      <h4 className={`guest-group-heading status-${status}`}><Icon size={14} aria-hidden="true"/>{label}<span>{people.length}</span></h4>
      <ul>{people.map((person,i) => <li key={`${person.email}:${i}`}><span className={`attendee-avatar status-ring-${status}`} aria-hidden="true">{initial(person)}</span><div><strong>{person.name || person.email || 'Guest'}</strong>{person.name && person.email && person.name !== person.email && <small>{person.email}</small>}{person.organizer && <span className="attendee-status">Organizer</span>}</div></li>)}</ul>
    </section>)}</div>
  </details>;
}
