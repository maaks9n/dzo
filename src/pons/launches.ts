/**
 * launches.ts — detection.
 *
 * Two paths, both feed the same emitter:
 *   1. Websocket subscription to TokenLaunched (default, via publicnode).
 *   2. Block-range polling on RPC_WS_URL=off or when the socket goes quiet.
 *
 * Watchdog: if the socket delivers nothing for 45s, we re-subscribe and start
 * polling alongside until it wakes up. The feed never dies for good.
 */

import EventEmitter from 'node:events';
import { decodeEventLog, parseAbiItem } from 'viem';
import { client, wsClient, ADDR } from '../chain.js';
import { factoryAbi } from '../abi/factory.js';
import { gate } from '../chain.js';

export interface LaunchEvent {
  token: string;
  deployer: string;
  curve: string;
  pair: string;
  launchBlock: bigint;
  metadataURI: string;
  txHash: string;
  timestamp: number;
  detectedAtMs: number;
}

export interface Detector extends EventEmitter {
  start(): Promise<void>;
  stop(): void;
}

const TOKEN_LAUNCHED = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed deployer, address curve, address pair, uint256 launchBlock, string metadataURI)'
);

export function makeDetector(): Detector {
  const emitter = new EventEmitter() as Detector;
  let stopped = false;
  let lastEventAt = Date.now();

  async function pollLoop(fromBlock: bigint) {
    const c = client();
    while (!stopped) {
      try {
        const latest = await c.getBlockNumber();
        if (latest > fromBlock) {
          const logs = await c.getLogs({
            address: ADDR.factory,
            event: TOKEN_LAUNCHED,
            fromBlock: fromBlock + 1n,
            toBlock: latest,
          });
          for (const log of logs) await emitLog(log);
          fromBlock = latest;
        }
        await sleep(300);
      } catch (e) {
        // gate handles cooldown; slow down further on repeated errors
        await sleep(1000);
      }
    }
  }

  async function emitLog(log: any) {
    try {
      const decoded = decodeEventLog({ abi: [TOKEN_LAUNCHED], data: log.data, topics: log.topics });
      const blk = await client().getBlock({ blockNumber: log.blockNumber! });
      const ev: LaunchEvent = {
        token: (decoded.args.token as string).toLowerCase(),
        deployer: (decoded.args.deployer as string).toLowerCase(),
        curve: (decoded.args.curve as string).toLowerCase(),
        pair: (decoded.args.pair as string).toLowerCase(),
        launchBlock: decoded.args.launchBlock as bigint,
        metadataURI: (decoded.args.metadataURI as string) || '',
        txHash: log.transactionHash,
        timestamp: Number(blk.timestamp),
        detectedAtMs: Date.now(),
      };
      lastEventAt = Date.now();
      emitter.emit('launch', ev);
    } catch (e) {
      emitter.emit('error', e);
    }
  }

  async function startWs() {
    const ws = wsClient();
    if (!ws) return false;
    try {
      const unwatch = ws.watchContractEvent({
        address: ADDR.factory,
        abi: factoryAbi,
        eventName: 'TokenLaunched',
        onLogs: async (logs) => {
          for (const log of logs) await emitLog(log);
        },
        onError: (e) => emitter.emit('error', e),
      });
      // watchdog: if silent for 45s, kick off polling as fallback
      const wd = setInterval(async () => {
        if (Date.now() - lastEventAt > 45_000) {
          const latest = await client().getBlockNumber();
          pollLoop(latest - 10n).catch((e) => emitter.emit('error', e));
        }
      }, 15_000);
      wd.unref?.();
      emitter.once('stop', () => { unwatch(); clearInterval(wd); });
      return true;
    } catch (e) {
      emitter.emit('error', e);
      return false;
    }
  }

  emitter.start = async () => {
    const ok = await startWs();
    if (!ok) {
      const latest = await client().getBlockNumber();
      pollLoop(latest).catch((e) => emitter.emit('error', e));
    }
  };
  emitter.stop = () => {
    stopped = true;
    emitter.emit('stop');
  };
  return emitter;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
