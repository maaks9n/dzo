/**
 * curveTrade.ts — buy / sell on the bonding curve.
 * Enforces minTokensOut / minEthOut based on quotes computed in the protocol's integer order.
 */

import { client } from '../chain.js';
import { walletClient } from './wallet.js';
import { curveAbi } from '../abi/curve.js';
import { quoteBuy, quoteSell, withSlippage, type CurveState } from '../pons/curve.js';

export interface CurveBuyResult {
  txHash: string;
  tokensReceived: bigint;
  ethSpent: bigint;
  effectiveTaxBps: number;
}

export async function buyOnCurve(params: {
  curve: string;
  ethIn: bigint;
  state: CurveState;
  currentTaxBps: number;
  slippageBps?: number;
  live: boolean;
}): Promise<CurveBuyResult> {
  const quote = quoteBuy(params.state, params.ethIn, params.currentTaxBps);
  const minOut = withSlippage(quote, params.slippageBps ?? 100);

  if (!params.live) {
    return {
      txHash: '0xdryrun',
      tokensReceived: quote,
      ethSpent: params.ethIn,
      effectiveTaxBps: params.currentTaxBps,
    };
  }

  const { client: w, account } = walletClient();
  const hash = await w.writeContract({
    address: params.curve as `0x${string}`,
    abi: curveAbi,
    functionName: 'buy',
    args: [minOut],
    value: params.ethIn,
    account,
    chain: null,
  });
  const receipt = await client().waitForTransactionReceipt({ hash });
  // Real tokensReceived / ethSpent would be parsed from CurveBuy in the receipt.
  return { txHash: hash, tokensReceived: quote, ethSpent: params.ethIn, effectiveTaxBps: params.currentTaxBps };
}

export async function sellOnCurve(params: {
  curve: string;
  tokensIn: bigint;
  state: CurveState;
  slippageBps?: number;
  live: boolean;
}): Promise<{ txHash: string; ethOut: bigint }> {
  const quote = quoteSell(params.state, params.tokensIn);
  const minOut = withSlippage(quote, params.slippageBps ?? 150);

  if (!params.live) return { txHash: '0xdryrun', ethOut: quote };

  const { client: w, account } = walletClient();
  const hash = await w.writeContract({
    address: params.curve as `0x${string}`,
    abi: curveAbi,
    functionName: 'sell',
    args: [params.tokensIn, minOut],
    account,
    chain: null,
  });
  await client().waitForTransactionReceipt({ hash });
  return { txHash: hash, ethOut: quote };
}
