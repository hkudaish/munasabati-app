// Types for backup-engine.cjs (used by the admin page's server code).
export interface Storage {
  kind: 'file' | 'blob';
  describe(): string;
  sub(name: string): Storage;
  list(): Promise<string[]>;
  read(name: string): Promise<Buffer | null>;
  write(name: string, data: Buffer): Promise<void>;
  remove(name: string): Promise<void>;
  acquireLock(): Promise<() => Promise<void>>;
}
export declare class FileStorage implements Storage {
  constructor(dir: string);
  kind: 'file';
  dir: string;
  describe(): string;
  sub(name: string): Storage;
  list(): Promise<string[]>;
  read(name: string): Promise<Buffer | null>;
  write(name: string, data: Buffer): Promise<void>;
  remove(name: string): Promise<void>;
  acquireLock(): Promise<() => Promise<void>>;
}
export declare class BlobStorage implements Storage {
  constructor(store: unknown, prefix?: string);
  kind: 'blob';
  describe(): string;
  sub(name: string): Storage;
  list(): Promise<string[]>;
  read(name: string): Promise<Buffer | null>;
  write(name: string, data: Buffer): Promise<void>;
  remove(name: string): Promise<void>;
  acquireLock(): Promise<() => Promise<void>>;
}

export interface Manifest {
  format: number; id: string; type: 'full' | 'incremental'; createdAt: string; parent: string | null; schema: string;
  schemaFingerprint: string; encrypted: boolean; label: string; chainHash: string;
  files: { data: { name: string; sha256: string; bytes: number }; state: { name: string; sha256: string; bytes: number } };
  stats: { tables: number; rows: number; upserts: number; deletes: number };
  tables: Record<string, { rows: number; upserts: number; deletes: number; pk: string[] }>;
  excluded: string[];
}
export interface PreviewTable { table: string; backupRows: number; liveRows: number; toAdd: number; toRemove: number; toChange: number; sample: { add: string[]; remove: string[]; change: string[] } }
export interface Preview {
  head: { id: string; type: string; createdAt: string; rows: number };
  chainLength: number; compatible: boolean;
  totals: { toAdd: number; toRemove: number; toChange: number; unchanged: number };
  tables: PreviewTable[]; preserved: string[]; sessionsRevoked: boolean;
}
export interface RestoreResult { head: Manifest; tables: number; rows: number; verified: boolean; mismatches: string[] }
export interface Policy { fullEveryDays: number; maxIncrementals: number; keepChains: number }

type Db = unknown; // a Prisma client
export declare const DEFAULT_POLICY: Policy;
export declare const DEFAULT_EXCLUDE: string[];
export declare const DEFAULT_PRESERVE: string[];
export declare function createBackup(o: { prisma: Db; schema?: string; storage: Storage; type: 'full' | 'incremental'; exclude?: string[]; force?: boolean; label?: string; onStep?: (s: string) => void; key?: Buffer | null }): Promise<{ manifest: Manifest; changed: number }>;
export declare function previewRestore(o: { prisma: Db; storage: Storage; schema?: string; headId?: string; exclude?: string[]; preserve?: string[]; key?: Buffer | null }): Promise<Preview>;
export declare function restoreBackup(o: { prisma: Db; storage: Storage; schema?: string; headId?: string; replace?: boolean; exclude?: string[]; preserve?: string[]; safetyStorage?: Storage | null; log?: (m: string) => void; key?: Buffer | null }): Promise<RestoreResult>;
export declare function verifyChain(storage: Storage, headId: string, o?: { key?: Buffer | null }): Promise<{ ok: boolean; problems: string[]; chain: Manifest[] }>;
export declare function readManifests(storage: Storage): Promise<Manifest[]>;
export declare function nextAutoType(manifests: Manifest[], policy?: Policy, now?: number): { type: 'full' | 'incremental'; why: string };
export declare function prune(storage: Storage, keepChains?: number): Promise<string[]>;
export declare function encryptionKey(): Buffer | null;
