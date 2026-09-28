export const LAB_BASE = "/lab";

export const CLASS_LABELS = [
  "contradiction",
  "entailment",
  "neutral",
] as const;

export type ClassLabel = (typeof CLASS_LABELS)[number];

export type ClassifyHit = {
  label: string;
  probs: Record<ClassLabel, number>;
  raw: number[];
};

export type LabStatus = {
  ok: boolean;
  model: string | null;
  version: string | null;
  error?: string;
};

function asProbs(raw: number[]): Record<ClassLabel, number> {
  return {
    contradiction: raw[0] ?? 0,
    entailment: raw[1] ?? 0,
    neutral: raw[2] ?? 0,
  };
}

export async function fetchLabStatus(): Promise<LabStatus> {
  try {
    const [modelsRes, versionRes] = await Promise.all([
      fetch(`${LAB_BASE}/v1/models`),
      fetch(`${LAB_BASE}/version`),
    ]);
    if (!modelsRes.ok) {
      return { ok: false, model: null, version: null, error: `HTTP ${modelsRes.status}` };
    }
    const models = await modelsRes.json();
    const model = models?.data?.[0]?.id ?? null;
    let version: string | null = null;
    if (versionRes.ok) {
      const body = await versionRes.json();
      version = body?.version ?? null;
    }
    return { ok: true, model, version };
  } catch (err) {
    return {
      ok: false,
      model: null,
      version: null,
      error: err instanceof Error ? err.message : "unreachable",
    };
  }
}

export async function classify(
  input: string,
  model: string,
): Promise<ClassifyHit> {
  const response = await fetch(`${LAB_BASE}/classify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  if (!response.ok) {
    throw new Error(`classify HTTP ${response.status}`);
  }
  const body = await response.json();
  const row = body?.data?.[0];
  if (!row) throw new Error("Empty classify response");
  const raw: number[] = row.probs ?? [];
  return {
    label: row.label,
    probs: asProbs(raw),
    raw,
  };
}

/** Yes probability from NLI-style classify. */
export function noulFromHit(hit: ClassifyHit): number {
  const yes = hit.probs.entailment;
  const no = hit.probs.contradiction;
  const denom = yes + no;
  if (denom < 1e-6) return hit.probs.entailment;
  return yes / denom;
}

export function normalize(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 1 / Math.max(weights.length, 1));
  return weights.map((w) => w / sum);
}

export async function decideNoul(
  context: string,
  claim: string,
  model: string,
): Promise<{ hit: ClassifyHit; yes: number }> {
  const hit = await classify(`Context: ${context}\nClaim: ${claim}`, model);
  return { hit, yes: noulFromHit(hit) };
}

export async function decideChoice(
  context: string,
  options: string[],
  model: string,
): Promise<{ id: string; label: string; p: number; hit: ClassifyHit }[]> {
  const rows = await Promise.all(
    options.map(async (label) => {
      const hit = await classify(
        `Context: ${context}\nClaim: The best next action or route is "${label}".`,
        model,
      );
      return { id: label, label, hit, weight: noulFromHit(hit) };
    }),
  );
  const probs = normalize(rows.map((r) => r.weight));
  return rows.map((r, i) => ({
    id: r.id,
    label: r.label,
    p: probs[i] ?? 0,
    hit: r.hit,
  }));
}

export async function decideScore(
  context: string,
  steps: string[],
  model: string,
): Promise<{
  steps: { label: string; p: number; hit: ClassifyHit }[];
  index: number;
  confidence: number;
}> {
  const rows = await Promise.all(
    steps.map(async (label) => {
      const hit = await classify(
        `Context: ${context}\nClaim: The correct level on the scale is "${label}".`,
        model,
      );
      return { label, hit, weight: noulFromHit(hit) };
    }),
  );
  const probs = normalize(rows.map((r) => r.weight));
  let index = 0;
  let best = -1;
  probs.forEach((p, i) => {
    if (p > best) {
      best = p;
      index = i;
    }
  });
  return {
    steps: rows.map((r, i) => ({
      label: r.label,
      p: probs[i] ?? 0,
      hit: r.hit,
    })),
    index,
    confidence: probs[index] ?? 0,
  };
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function answerTone(yes: number) {
  if (yes >= 0.6) {
    return {
      title: "Yes",
      detail: "Entailment outweighs contradiction.",
      tone: "yes" as const,
    };
  }
  if (yes <= 0.4) {
    return {
      title: "No",
      detail: "Contradiction outweighs entailment.",
      tone: "no" as const,
    };
  }
  return {
    title: "Uncertain",
    detail: "Signal is mixed between yes and no.",
    tone: "soft" as const,
  };
}
