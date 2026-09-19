import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Start a fresh archive so removed assets from old releases cannot linger.
const directory = mkdtempSync(join(tmpdir(), 'wealthfolio-bundle-'));
try {
  const archive = join(directory, 'addon.zip');
  execFileSync('zip', ['-r', archive, 'manifest.json', 'dist/'], { stdio: 'inherit' });
  copyFileSync(archive, 'addon.zip');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
