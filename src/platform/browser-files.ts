import type { FileExchange } from './ports';
import { TASK_BACKUP_LIMIT } from '../services/task-backup';
import { ServiceError } from '../services/errors';

export class BrowserFileExchange implements FileExchange {
  pick(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
      const finish = () => input.remove();
      input.oncancel = () => { finish(); resolve(null); };
      input.onchange = () => {
        const file = input.files?.[0]; finish();
        if (!file) { resolve(null); return; }
        if (file.size > TASK_BACKUP_LIMIT) { reject(new ServiceError('validation', 'Choose a Weekaboo task backup smaller than 4 MB.')); return; }
        file.text().then(resolve, () => reject(new ServiceError('unavailable', 'That file could not be opened.')));
      };
      document.body.append(input); input.click();
    });
  }
  async save({ name, contents }: { name: string; contents: string }) {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }
}
