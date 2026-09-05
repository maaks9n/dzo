/**
 * fees.ts — creator-fee forensics from the escrow's own Credited / Claimed events.
 */

import { parseAbiItem } from 'viem';
import { client, ADDR } from '../chain.js';
import { feeEscrowAbi } from '../abi/feeEscrow.js';

const CREDITED = parseAbiItem('event Credited(address indexed token, address indexed recipient, uint256 amount, uint8 source)');
const CLAIMED  = parseAbiItem('event Claimed(address indexed recipient, uint256 amount)');

export interface FeeReport {
  token: string;
  recipient: string;
  accruedFromCurve: bigint;
  accruedFromPool: bigint;
  pending: bigint;
  claims: Array<{ amount: bigint; block: number; txHash: string; timestamp: number }>;
}

export async function feeReport(token: string, sinceBlock: bigint = 0n): Promise<FeeReport> {
  const c = client();
  const latest = await c.getBlockNumber();
  const from = sinceBlock === 0n ? latest - 400_000n : sinceBlock;

  const credited = await c.getLogs({ address: ADDR.feeEscrow, event: CREDITED, args: { token: token as `0x${string}` }, fromBlock: from, toBlock: latest });
  let recipient = '';
  let curveTotal = 0n;
  let poolTotal = 0n;
  for (const log of credited) {
    const args = log.args as any;
    recipient = (args.recipient as string).toLowerCase();
    if (Number(args.source) === 0) curveTotal += args.amount as bigint;
    else poolTotal += args.amount as bigint;
  }

  const claimed = recipient
    ? await c.getLogs({ address: ADDR.feeEscrow, event: CLAIMED, args: { recipient: recipient as `0x${string}` }, fromBlock: from, toBlock: latest })
    : [];

  const claims = await Promise.all(claimed.map(async (log) => {
    const blk = await c.getBlock({ blockNumber: log.blockNumber! });
    return {
      amount: (log.args as any).amount as bigint,
      block: Number(log.blockNumber),
      txHash: log.transactionHash!,
      timestamp: Number(blk.timestamp),
    };
  }));

  let pending = 0n;
  if (recipient) {
    pending = await c.readContract({ address: ADDR.feeEscrow, abi: feeEscrowAbi, functionName: 'pending', args: [recipient as `0x${string}`] });
  }

  return { token, recipient, accruedFromCurve: curveTotal, accruedFromPool: poolTotal, pending, claims };
}
