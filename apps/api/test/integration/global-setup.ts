import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Starts one Postgres container per run and applies the migrations to it.
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const databaseUrl = container.getConnectionUri();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: `${import.meta.dirname}/../..`,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
