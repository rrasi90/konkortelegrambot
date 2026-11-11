/**
 * V3-052 — تست گراف پیش‌نیاز typed (مأموریت v5 §9)
 * dangling، duplicate، self-loop، cycle، proposal-only و fail-closed.
 */
import { describe, expect, it } from 'vitest';
import {
  buildValidatedGraph,
  directPrerequisites,
  markMissingSkillProposal,
  validatePrereqGraph,
  type PrereqEdge,
} from '@ael/engine';

const NODES = ['n.math', 'n.stats', 'n.anova', 'n.rbv'];

describe('V3-052 typed prerequisite graph', () => {
  it('a valid DAG builds adjacency and direct prerequisites', () => {
    const edges: PrereqEdge[] = [
      { from: 'n.math', to: 'n.stats', relation: 'prerequisite', status: 'verified', provenance: 'درسنامهٔ AEL' },
      { from: 'n.stats', to: 'n.anova', relation: 'prerequisite', status: 'reported', provenance: 'سرفصل رسمی' },
      { from: 'n.rbv', to: 'n.stats', relation: 'recommended', status: 'reported' },
    ];
    const validation = validatePrereqGraph(NODES, edges);
    expect(validation.errors).toEqual([]);
    expect(validation.cycles).toEqual([]);
    const graph = buildValidatedGraph(NODES, edges);
    expect(directPrerequisites(graph, 'n.anova')).toEqual(['n.stats']);
    expect(graph.withPrereqs.has('n.anova')).toBe(true);
    // recommended در withPrereqs نمی‌آید (معنای ترتیبی ندارد):
    expect(graph.withPrereqs.has('n.stats')).toBe(true);
  });

  it('cycle detection only on ordered relations (prerequisite/corequisite)', () => {
    const cycEdges: PrereqEdge[] = [
      { from: 'n.stats', to: 'n.math', relation: 'prerequisite', status: 'verified' },
      { from: 'n.math', to: 'n.stats', relation: 'prerequisite', status: 'verified' },
    ];
    const result = validatePrereqGraph(NODES, cycEdges);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('cycle'))).toBe(true);
    // cycle در confusable_with خطا نیست:
    const okConfusable: PrereqEdge[] = [
      { from: 'n.stats', to: 'n.rbv', relation: 'confusable_with', status: 'verified' },
      { from: 'n.rbv', to: 'n.stats', relation: 'confusable_with', status: 'verified' },
    ];
    expect(validatePrereqGraph(NODES, okConfusable).errors).toEqual([]);
  });

  it('detects dangling refs, self-loops, duplicates and invalid enums', () => {
    const bad: PrereqEdge[] = [
      { from: 'n.ghost', to: 'n.stats', relation: 'prerequisite', status: 'verified' },
      { from: 'n.stats', to: 'n.stats', relation: 'prerequisite', status: 'verified' },
      { from: 'n.math', to: 'n.stats', relation: 'prerequisite', status: 'verified' },
      { from: 'n.math', to: 'n.stats', relation: 'prerequisite', status: 'reported' },
      { from: 'n.math', to: 'n.anova', relation: 'invented' as never, status: 'verified' },
    ];
    const result = validatePrereqGraph(NODES, bad);
    expect(result.dangling.length).toBe(1);
    expect(result.selfLoops.length).toBe(1);
    expect(result.duplicates.length).toBe(1);
    expect(result.errors.some((e) => e.includes('relation غیرمجاز'))).toBe(true);
  });

  it('buildValidatedGraph is fail-closed on any error', () => {
    expect(() => buildValidatedGraph(NODES, [
      { from: 'n.ghost', to: 'n.stats', relation: 'prerequisite', status: 'verified' },
    ])).toThrow(/fail-closed/);
  });

  it('proposals (C-08) need provenance+confidence and never become prerequisites', () => {
    const proposal = markMissingSkillProposal('n.rbv', 'n.anova', 'GRAPH_missing_skills.md', 0.72);
    const graph = buildValidatedGraph(NODES, [proposal]);
    // proposal در adjacency هست اما هرگز prerequisite عملیاتی نیست:
    expect(directPrerequisites(graph, 'n.anova')).toEqual([]);
    expect(graph.withPrereqs.has('n.anova')).toBe(false);
    // بدون provenance → رد:
    const invalid = validatePrereqGraph(NODES, [
      { from: 'n.rbv', to: 'n.anova', relation: 'prerequisite', status: 'proposal', confidence: 0.5 },
    ]);
    expect(invalid.errors.some((e) => e.includes('provenance'))).toBe(true);
  });
});
