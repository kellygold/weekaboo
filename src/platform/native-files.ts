import { registerPlugin } from '@capacitor/core';
import type { FileExchange } from './ports';
const files = registerPlugin<{
  pick(): Promise<{ contents: string | null }>;
  save(input: { name: string; contents: string }): Promise<{ saved: boolean }>;
}>('WeekabooFiles');
export class NativeFileExchange implements FileExchange {
  async pick() { return (await files.pick()).contents; }
  async save(input: { name: string; contents: string }) { return (await files.save(input)).saved; }
}
