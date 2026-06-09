export interface Benchmark {
  key:            string;
  label:          string;
  desc:           string;
  unit:           string;    // '%' | '$/1M'
  higherIsBetter: boolean;   // false for cost axes
}

export interface Model {
  id:           string;
  slug:         string;
  name:         string;
  family:       string;
  brand:        string;
  type:         'open' | 'closed';
  released:     string;           // ISO date YYYY-MM-DD
  effort:       'low' | 'medium' | 'high' | 'xhigh' | null;
  vfl:          number;           // version-family rank: 0 = latest in its type-group
  openRouterId: string | null;    // OpenRouter model ID, null if not on OpenRouter
  inference?:   InferenceEntry;   // Inference availability
  sources:      string[];         // e.g. ['livebench'] or ['hf_leaderboard']
  scores:       Record<string, number | null | undefined>;
}

export interface InferenceEntry {
  ollamaCloud: boolean;  // hosted on Ollama Cloud — no local GPU needed
  ollamaLocal: boolean;  // has a known `ollama pull` tag — runs locally
  openRouter:  boolean;  // available on OpenRouter
}

export type InferenceMap = Record<string, InferenceEntry>;

export interface BenchmarkData {
  generated:   string;
  dataset:     string;      // 'lb'
  openRouterOnly: boolean;  // always false in the static JSON; filtering is done client-side
  benchmarks:  Record<string, Benchmark>;
  familyOrder: string[];
  models:      Model[];
  modelCount?: number;      // informational, equals models.length
}
