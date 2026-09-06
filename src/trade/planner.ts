/**
 * planner.ts — multi-wallet planner. Opt-in via --wallets.
 * Each wallet has its own thresholds and budget; a fire is routed to the
 * highest-scored wallet that will accept it.
 */

export interface WalletProfile {
  name: string;
  keyfile: string;
  minScore: number;
  maxDevShare: number;
  ethPerShot: number;
  budget: number;      // ETH
  spent: number;       // ETH
}

export function pickWallet(profiles: WalletProfile[], score: number, devShare: number): WalletProfile | null {
  // strictest first
  const candidates = profiles
    .filter((p) => p.spent + p.ethPerShot <= p.budget)
    .filter((p) => score >= p.minScore && devShare <= p.maxDevShare)
    .sort((a, b) => b.minScore - a.minScore);
  return candidates[0] ?? null;
}

export function chargeWallet(p: WalletProfile, amount: number): void {
  p.spent += amount;
}
