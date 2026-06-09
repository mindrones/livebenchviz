import type { BenchmarkData } from './types';
import { base } from '$app/paths'; // base is correct for static asset paths — resolve() is for routes only

export async function loadDataset(
  svelteFetch: typeof fetch = globalThis.fetch
): Promise<{ benchmarkData: BenchmarkData | null; error: string | null }> {
  try {
    const benchRes = await svelteFetch(`${base}/benchmark_lb.json`, { signal: AbortSignal.timeout(8_000) });
    if (!benchRes.ok) throw new Error(`HTTP ${benchRes.status}`);
    const benchmarkData: BenchmarkData = await benchRes.json();
    return { benchmarkData, error: null };
  } catch (e) {
    return { benchmarkData: null, error: `Failed to load data: ${e instanceof Error ? e.message : e}` };
  }
}
