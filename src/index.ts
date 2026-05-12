#!/usr/bin/env node

/**
 * Azure DevOps Work Items Creator — Application Entry Point
 *
 * CLI tool to create work items with PM-driven refinement
 * (Epic → Feature → User Stories)
 *
 * Validates: Requirements 1.1
 */

import { Orchestrator } from './application/orchestrator';

async function main(): Promise<void> {
  const orchestrator = new Orchestrator();
  await orchestrator.run();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Fatal error:', message);
  process.exit(1);
});
