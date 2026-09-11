export const calendarProviders = {
  google: { name: 'Google', connect: 'Connect Google' },
  microsoft: { name: 'Microsoft', connect: 'Connect Microsoft' },
  icloud: { name: 'iCloud', connect: 'Connect iCloud' },
  local: { name: 'Sample', connect: '' },
} as const;
export function providerName(provider: string): string {
  return calendarProviders[provider as keyof typeof calendarProviders]?.name || provider;
}
