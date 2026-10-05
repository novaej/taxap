/**
 * Local filesystem storage for uploaded SRI source files (NEXT_STEPS.md
 * -> "Storage of original files"). Keeping the raw `.txt` lets a period
 * be reprocessed later without asking the user to re-upload it -- the
 * same files are already fully parsed into invoices_received/issued, so
 * this isn't a new privacy exposure beyond what's already in the
 * database. Retention/archival policy is still undecided
 * (`NEXT_STEPS.md`); this only stores, indefinitely, with no cleanup job.
 *
 * Keyed by (taxpayerId, sha256), not by `SourceFile.id`: the id is
 * DB-generated and unknown until after the row is inserted, while the
 * hash is already computed before that -- and re-uploading identical
 * content lands on the same path instead of accumulating duplicates.
 *
 * `/storage` is gitignored, same sensitivity class as `/samples` (real
 * tax data). Only a local filesystem driver exists today -- no env var,
 * no abstraction to select a different one, since there's nothing to
 * switch to yet. Add one if/when S3 (or similar) is actually needed.
 */

import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');

function resolvePath(taxpayerId: string, sha256: string): string {
  return path.join(STORAGE_ROOT, taxpayerId, `${sha256}.txt`);
}

export async function saveSourceFile(
  taxpayerId: string,
  sha256: string,
  content: string
): Promise<void> {
  const filePath = resolvePath(taxpayerId, sha256);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

export async function readSourceFile(taxpayerId: string, sha256: string): Promise<string> {
  return readFile(resolvePath(taxpayerId, sha256), 'utf-8');
}

export async function deleteSourceFile(taxpayerId: string, sha256: string): Promise<void> {
  try {
    await unlink(resolvePath(taxpayerId, sha256));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
