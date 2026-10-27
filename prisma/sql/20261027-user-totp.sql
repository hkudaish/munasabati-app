-- Second sign-in factor (authenticator app) for any account that enrols. Additive; accounts without a row sign in with a password only.
-- "secret" is AES-256-GCM encrypted by the application; recovery codes are stored only as SHA-256 hashes and are single use.
CREATE TABLE IF NOT EXISTS "UserTotp" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "secret" TEXT NOT NULL,
  "enabledAt" TIMESTAMPTZ(3),
  "lastStep" BIGINT NOT NULL DEFAULT 0,
  "recoveryHashes" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
