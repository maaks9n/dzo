/**
 * rpcGate.ts — health-scored RPC pool with per-method routing.
 *
 * Each endpoint declares its capabilities (which JSON-RPC methods it will
 * answer). The gate keeps a rolling health score per endpoint (p95 latency
 * and refuse rate over the last 60s). Requests are routed to the highest-
 * scoring healthy endpoint that supports the method. Bounded concurrency,
 * min spacing, cooldown after 429, penalty box per endpoint, retries that
 * wait instead of failing.
 *
 * This is the single point where every read touches the network. That
 * property is important: it lets us apply one global policy (spacing,
 * concurrency) and one global observation (health).
 */

interface Endpoint {
  url: string;
  name: string;
  capabilities: Set<string>;
  weight: number;
  // rolling state
  latencies: number[];      // last 20 successful round trips (ms)
  refusals: number;         // 429/timeouts in the last 60s window
  penaltyUntil: number;     // epoch ms; skip until then
  lastCall: number;         // epoch ms of last dispatched call
}

interface GateOptions {
  endpoints: Array<Omit<Endpoint, 'latencies' | 'refusals' | 'penaltyUntil' | 'lastCall'>>;
  maxInFlight: number;
  spacingMs: number;
  logsSpacingMs: number;
  cooldownMs: number;
}

export interface RpcGate {
  call<T = unknown>(method: string, params: unknown[]): Promise<T>;
  health(): Array<{ name: string; url: string; score: number; refusals: number; latencyP95: number; penaltyMs: number }>;
}

export function makeRpcGate(opts: GateOptions): RpcGate {
  const eps: Endpoint[] = opts.endpoints.map((e) => ({
    ...e,
    latencies: [],
    refusals: 0,
    penaltyUntil: 0,
    lastCall: 0,
  }));
  let inFlight = 0;
  let globalCooldownUntil = 0;

  // decay refusal count every 10s
  setInterval(() => {
    for (const ep of eps) ep.refusals = Math.max(0, ep.refusals - 1);
  }, 10_000).unref?.();

  function score(ep: Endpoint): number {
    if (Date.now() < ep.penaltyUntil) return -Infinity;
    const p95 = percentile(ep.latencies, 0.95) || 200;
    // higher weight better; higher refusals + latency worse
    return ep.weight * 1000 - p95 - ep.refusals * 500;
  }

  function pickFor(method: string): Endpoint | null {
    const eligible = eps.filter((e) => e.capabilities.has(method));
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => score(b) - score(a));
    return eligible[0]!;
  }

  async function waitSlot(spacing: number, ep: Endpoint) {
    while (inFlight >= opts.maxInFlight || Date.now() < globalCooldownUntil) {
      await sleep(25);
    }
    const since = Date.now() - ep.lastCall;
    if (since < spacing) await sleep(spacing - since);
    inFlight++;
    ep.lastCall = Date.now();
  }

  async function call<T>(method: string, params: unknown[]): Promise<T> {
    let attempts = 0;
    let lastErr: unknown = null;

    while (attempts < 5) {
      attempts++;
      const ep = pickFor(method);
      if (!ep) throw new Error(`no endpoint supports ${method}`);

      const spacing = method === 'eth_getLogs' ? opts.logsSpacingMs : opts.spacingMs;
      await waitSlot(spacing, ep);

      const t0 = Date.now();
      try {
        const body = JSON.stringify({ jsonrpc: '2.0', id: t0, method, params });
        const res = await fetch(ep.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        if (res.status === 429) {
          ep.refusals++;
          ep.penaltyUntil = Date.now() + 3_000;
          globalCooldownUntil = Date.now() + opts.cooldownMs;
          throw new Error('429');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json() as { result?: T; error?: { message: string } };
        if (j.error) throw new Error(j.error.message);
        const dt = Date.now() - t0;
        ep.latencies.push(dt);
        if (ep.latencies.length > 20) ep.latencies.shift();
        return j.result as T;
      } catch (e) {
        lastErr = e;
        await sleep(200 * attempts);
      } finally {
        inFlight = Math.max(0, inFlight - 1);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  function health() {
    return eps.map((e) => ({
      name: e.name,
      url: e.url,
      score: score(e),
      refusals: e.refusals,
      latencyP95: percentile(e.latencies, 0.95),
      penaltyMs: Math.max(0, e.penaltyUntil - Date.now()),
    }));
  }

  return { call, health };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}
