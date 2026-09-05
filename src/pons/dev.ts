/**
 * dev.ts — deployer history served from the SQLite index.
 */

import { statsFor, launchesByDeployer, type LaunchRow, type DeployerStats } from './deployerIndex.js';

export interface DevReport {
  stats: DeployerStats;
  launches: LaunchRow[];
}

export function devReport(deployer: string, sinceBlock?: number): DevReport {
  return {
    stats: statsFor(deployer, sinceBlock),
    launches: launchesByDeployer(deployer),
  };
}
