import type { BenchmarkData, InferenceMap } from './types';
import { base } from '$app/paths'; // base is correct for static asset paths — resolve() is for routes only

export async function loadDataset(
  svelteFetch: typeof fetch = globalThis.fetch
): Promise<{ benchmarkData: BenchmarkData | null; inferenceMap: InferenceMap; error: string | null }> {
  try {
    const [benchRes, infRes] = await Promise.all([
      svelteFetch(`${base}/benchmark_lb.json`, { signal: AbortSignal.timeout(8_000) }),
      svelteFetch(`${base}/inference.json`,    { signal: AbortSignal.timeout(8_000) }),
    ]);
    if (!benchRes.ok) throw new Error(`HTTP ${benchRes.status}`);
    const benchmarkData: BenchmarkData = await benchRes.json();
    const inferenceMap: InferenceMap   = infRes.ok
      ? ((await infRes.json()) as { entries: InferenceMap }).entries
      : {};
    return { benchmarkData, inferenceMap, error: null };
  } catch (e) {
    return { benchmarkData: null, inferenceMap: {}, error: `Failed to load data: ${e instanceof Error ? e.message : e}` };
  }
}
