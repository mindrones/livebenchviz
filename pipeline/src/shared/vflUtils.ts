/**
 * shared/vflUtils.ts
 * Version-family-latest (vfl) rank computation.
 *
 * vfl = 0  means "latest release in its provider+type group"
 * vfl = 1  means "second latest", etc.
 *
 * Open and closed models within the same provider family are ranked
 * independently — so the latest Gemma and the latest Gemini are both vfl 0.
 */

export interface VflModel {
  id:       string;
  family:   string;
  type:     'open' | 'closed';
  released: string;   // ISO date (may be empty string → treated as 2020-01-01)
}

/**
 * Compute vfl ranks for a flat list of models from one or more families.
 * Returns a Map<id, vfl>.
 */
export function computeVfl(models: VflModel[]): Map<string, number> {
  // Group by family + type
  const groups = new Map<string, VflModel[]>();
  for (const m of models) {
    const key = `${m.family}\0${m.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const vflMap = new Map<string, number>();

  for (const group of groups.values()) {
    // Sort ascending by release date (oldest first); ties broken by id
    const sorted = [...group].sort((a, b) => {
      const da = a.released || '2020-01-01';
      const db = b.released || '2020-01-01';
      if (da < db) return -1;
      if (da > db) return 1;
      return a.id.localeCompare(b.id);
    });
    // Assign: last in sorted (newest) gets 0, second-newest gets 1, …
    sorted.forEach((m, i) => vflMap.set(m.id, sorted.length - 1 - i));
  }

  return vflMap;
}
