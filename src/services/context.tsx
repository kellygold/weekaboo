import { createContext, useContext, type ReactNode } from 'react';
import type { AppServices } from './contracts';

const Context = createContext<AppServices | null>(null);
export function ServiceProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <Context.Provider value={services}>{children}</Context.Provider>;
}
export function useServices(): AppServices {
  const services = useContext(Context);
  if (!services) throw new Error('Weekaboo services must be supplied by the application entry point.');
  return services;
}
