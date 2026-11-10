/**
 * V3-052 — گراف پیش‌نیاز typed (مأموریت v5 §9)
 *
 * یال‌ها جهت‌دار و typed هستند (relationهای مستقل)؛ validatorها:
 *   - dangling reference (یال به نود ناموجود)
 *   - duplicate edge (همان from/to/relation دوبار)
 *   - self-loop (from === to)
 *   - cycle detection در یال‌های prerequisite/corequisite (که ترتیب اجرا را می‌شکنند)
 * یال‌های recommended/confusable_with ماهیت ترتیبی ندارند و cycle در آن‌ها خطا نیست.
 * رفتار با گراف ناقص: fail-closed — نتایج فقط پس از validation معتبر تولید می‌شوند.
 * هیچ یال از شباهت واژه‌ای ساخته نمی‌شود؛ پیشنهادهای C-08 با provenance/confidence
 * به‌صورت proposal باقی می‌مانند (markProposal) و خودکار fact نمی‌شوند.
 */

export const EDGE_RELATIONS = [
  'prerequisite', 'corequisite', 'recommended', 'confusable_with',
] as const;
export type EdgeRelation = (typeof EDGE_RELATIONS)[number];

/** یال‌هایی که معنای ترتیبِ یادگیری دارند و cycle در آن‌ها ممنوع است */
const ORDERED_RELATIONS: EdgeRelation[] = ['prerequisite', 'corequisite'];

export const EDGE_STATES = ['verified', 'reported', 'proposal'] as const;
export type EdgeState = (typeof EDGE_STATES)[number];

export interface PrereqEdge {
  from: string;
  to: string;
  relation: EdgeRelation;
  status: EdgeState;
  /** منشأ یال: سند/درسنامه — شباهت واژه‌ای مجاز نیست */
  provenance?: string;
  /** فقط برای proposal (C-08) */
  confidence?: number;
}

export interface GraphValidation {
  errors: string[];
  /** id نودهای درگیر در cycle (فقط یال‌های ترتیبی) */
  cycles: string[][];
  dangling: Array<{ from: string; to: string }>;
  selfLoops: Array<{ from: string; to: string; relation: EdgeRelation }>;
  duplicates: Array<{ from: string; to: string; relation: EdgeRelation }>;
}

export interface ValidatedGraph {
  adjacency: Map<string, Array<{ to: string; relation: EdgeRelation; status: EdgeState }>>;
  /** نود → پیش‌نیازهای مستقیم (فقط prerequisite غیرproposal) */
  prereqsByNode: Map<string, string[]>;
  /** نودهایی که prerequisite تأییدشده دارند (برای planner) */
  withPrereqs: Set<string>;
}

export function validatePrereqGraph(nodeIds: Iterable<string>, edges: PrereqEdge[]): GraphValidation {
  const errors: string[] = [];
  const nodes = new Set(nodeIds);
  const result: GraphValidation = { errors, cycles: [], dangling: [], selfLoops: [], duplicates: [] };

  const seen = new Set<string>();
  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      result.dangling.push({ from: edge.from, to: edge.to });
      errors.push(`یال dangling: ${edge.from} → ${edge.to}`);
    }
    if (edge.from === edge.to) {
      result.selfLoops.push({ from: edge.from, to: edge.to, relation: edge.relation });
      errors.push(`self-loop: ${edge.from} (${edge.relation})`);
    }
    const key = `${edge.from}|${edge.to}|${edge.relation}`;
    if (seen.has(key)) {
      result.duplicates.push({ from: edge.from, to: edge.to, relation: edge.relation });
      errors.push(`یال تکراری: ${key}`);
    }
    seen.add(key);
    collectErrors(errors, EDGE_RELATIONS.includes(edge.relation), `relation غیرمجاز: ${edge.relation}`);
    collectErrors(errors, EDGE_STATES.includes(edge.status), `status غیرمجاز: ${edge.status}`);
    if (edge.status === 'proposal') {
      collectErrors(errors, typeof edge.confidence === 'number' && edge.confidence >= 0 && edge.confidence <= 1,
        `proposal ${key}: confidence لازم است (۰..۱)`);
      collectErrors(errors, typeof edge.provenance === 'string' && edge.provenance.length > 0,
        `proposal ${key}: provenance لازم است (C-08)`);
    }
  }

  // cycle detection فقط روی یال‌های ترتیبی (prerequisite/corequisite):
  const orderedAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ORDERED_RELATIONS.includes(edge.relation)) continue;
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    const list = orderedAdj.get(edge.from) ?? [];
    list.push(edge.to);
    orderedAdj.set(edge.from, list);
  }

  const color = new Map<string, 1 | 2>(); // 1=در استک، 2=تمام‌شده
  const stack: string[] = [];
  const dfs = (node: string): void => {
    color.set(node, 1);
    stack.push(node);
    for (const next of orderedAdj.get(node) ?? []) {
      const c = color.get(next);
      if (c === 1) {
        const start = stack.indexOf(next);
        result.cycles.push([...stack.slice(start), next]);
        errors.push(`cycle در یال‌های ترتیبی: ${result.cycles[result.cycles.length - 1].join(' → ')}`);
      } else if (c === undefined) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, 2);
  };
  for (const node of nodes) if (!color.has(node)) dfs(node);

  return result;
}

/** گراف ناقص fail-closed: تا validation سبز نباشد adjacency تولید نمی‌شود. */
export function buildValidatedGraph(nodeIds: Iterable<string>, edges: PrereqEdge[]): ValidatedGraph {
  const validation = validatePrereqGraph(nodeIds, edges);
  if (validation.errors.length > 0) {
    throw new Error(`گراف پیش‌نیاز نامعتبر است (fail-closed): ${validation.errors.join(' | ')}`);
  }
  const adjacency = new Map<string, Array<{ to: string; relation: EdgeRelation; status: EdgeState }>>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push({ to: edge.to, relation: edge.relation, status: edge.status });
    adjacency.set(edge.from, list);
  }
  const prereqsByNode = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation !== 'prerequisite' || edge.status === 'proposal') continue;
    const list = prereqsByNode.get(edge.to) ?? [];
    list.push(edge.from);
    prereqsByNode.set(edge.to, list);
  }
  const withPrereqs = new Set(
    edges.filter((e) => e.relation === 'prerequisite' && e.status !== 'proposal').map((e) => e.to),
  );
  return { adjacency, prereqsByNode, withPrereqs };
}

/** پیش‌نیازهای مستقیمِ یک نود (فقط یال‌های تأییدشده/گزارش‌شده — proposal هرگز) */
export function directPrerequisites(graph: ValidatedGraph, nodeId: string): string[] {
  return graph.prereqsByNode.get(nodeId) ?? [];
}

/** ثبت پیشنهاد مفقود (C-08): proposal می‌ماند و هرگز خودکار verified نمی‌شود */
export function markMissingSkillProposal(
  from: string,
  to: string,
  provenance: string,
  confidence: number,
): PrereqEdge {
  return { from, to, relation: 'prerequisite', status: 'proposal', provenance, confidence };
}

function collectErrors(list: string[], condition: boolean, message: string): void {
  if (!condition) list.push(message);
}
