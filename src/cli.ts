#!/usr/bin/env node

import { Command } from 'commander';
import { importCommand } from './commands/import';
import { initCommand } from './commands/init';
import { syncCommand } from './commands/sync';
import { error } from './utils/logger';

const program = new Command();

program
  .name('ag-sync')
  .description(
    'Sync Codex agent and automation assets between a repo and ~/.codex',
  )
  .version('0.1.0');

program
  .command('init')
  .description(
    'Create ag-sync.json and import live Codex agent assets into the current repo',
  )
  .action(async () => {
    await runCommand(() => initCommand(process.cwd()));
  });

program
  .command('sync')
  .description('Sync configured agent and automation assets')
  .option('--watch', 'Watch for source changes and re-run sync')
  .action(async (options: { watch?: boolean }) => {
    await runCommand(() =>
      syncCommand(process.cwd(), { watch: options.watch }),
    );
  });

program
  .command('import')
  .description(
    'Import net-new files from configured destinations into the first source root for each asset family',
  )
  .action(async () => {
    await runCommand(() => importCommand(process.cwd()));
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  handleFatalError(err);
});

async function runCommand(command: () => Promise<void>): Promise<void> {
  try {
    await command();
  } catch (err) {
    handleFatalError(err);
  }
}

function handleFatalError(err: unknown): void {
  if (err instanceof Error) {
    error(`Error: ${err.message}`);
  } else {
    error(`Error: ${String(err)}`);
  }
  process.exit(1);
}
