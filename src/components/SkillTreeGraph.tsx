import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import {
  KnowledgeNode,
  NodeDependency,
  InteractiveLesson,
  CoverageStatus,
  QuestionItem,
} from '../data/konkorData';
import {
  LearnerSixDState,
  ROINodeRanking,
  MultiYearFrequencyInsight,
  classifyNodeCourseCategory,
} from '../engine/aelEngine';
import { tmaHaptic } from '../utils/telegramBridge';
import {
  Target,
  BookOpen,
  Play,
  Layers,
  Activity,
  Clock,
  TrendingUp,
  Flame,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  X,
  Network,
} from 'lucide-react';

interface SkillTreeGraphProps {
  nodes: KnowledgeNode[];
  dependencies: NodeDependency[];
  questions?: QuestionItem[];
  lessons: Record<string, InteractiveLesson>;
  nodeStates: Record<string, LearnerSixDState>;
  roiRankings: ROINodeRanking[];
  examFrequencyMap: Record<string, MultiYearFrequencyInsight>;
  onStartPracticeNode: (nodeId: string, mode: 'practice' | 'proof' | 'remedial') => void;
  onOpenLessonNode: (nodeId: string) => void;
}

const LAYER_TITLES = [
  'لایه ۰: مبانی و پیش‌نیازهای بنیادی (نقطه شروع داوطلب صفر)',
  'لایه ۱: چارچوب‌های تحلیلی و اقتضایی',
  'لایه ۲: استراتژی، مدل‌سازی و برند',
  'لایه ۳: مرز دانش و مباحث تلفیقی دکتری',
];

const STATUS_META: Record<
  CoverageStatus,
  {
    label: string;
    ringClass: string;
    badgeTextClass: string;
    shortStatus: string;
    cyBorderColor: string;
    cyBgColor: string;
    cyDarkBgColor: string;
  }
> = {
  mastered: {
    label: 'تثبیت‌شده (Mastered)',
    ringClass: 'stroke-emerald-500 dark:stroke-emerald-400',
    badgeTextClass: 'text-emerald-700 dark:text-emerald-300',
    shortStatus: 'تثبیت‌شده',
    cyBorderColor: '#10b981',
    cyBgColor: '#ecfdf5',
    cyDarkBgColor: '#064e3b',
  },
  proven: {
    label: 'اثبات‌شده با کنکور ۱۴۰۴',
    ringClass: 'stroke-teal-500 dark:stroke-teal-400',
    badgeTextClass: 'text-teal-700 dark:text-teal-300',
    shortStatus: 'اثبات‌شده ۱۴۰۴',
    cyBorderColor: '#14b8a6',
    cyBgColor: '#f0fdfa',
    cyDarkBgColor: '#134e4a',
  },
  needs_proof: {
    label: 'آماده اثبات تسلط (Holdout)',
    ringClass: 'stroke-amber-500 dark:stroke-amber-400',
    badgeTextClass: 'text-amber-700 dark:text-amber-300',
    shortStatus: 'آماده اثبات ۱۴۰۴',
    cyBorderColor: '#f59e0b',
    cyBgColor: '#fffbeb',
    cyDarkBgColor: '#78350f',
  },
  learning: {
    label: 'در حال یادگیری و جمع‌آوری شاهد',
    ringClass: 'stroke-blue-500 dark:stroke-blue-400',
    badgeTextClass: 'text-blue-700 dark:text-blue-300',
    shortStatus: 'در حال یادگیری',
    cyBorderColor: '#3b82f6',
    cyBgColor: '#eff6ff',
    cyDarkBgColor: '#1e3a8a',
  },
  weak: {
    label: 'نیازمند ترمیم شکاف (Gap)',
    ringClass: 'stroke-rose-500 dark:stroke-rose-400',
    badgeTextClass: 'text-rose-700 dark:text-rose-300',
    shortStatus: 'نیازمند ترمیم',
    cyBorderColor: '#f43f5e',
    cyBgColor: '#fff1f2',
    cyDarkBgColor: '#881337',
  },
  unseen: {
    label: 'شروع‌نشده (۰٪ — آماده مطالعه درسنامه)',
    ringClass: 'stroke-slate-400 dark:stroke-slate-600',
    badgeTextClass: 'text-slate-600 dark:text-slate-400',
    shortStatus: 'شروع‌نشده (۰٪)',
    cyBorderColor: '#94a3b8',
    cyBgColor: '#f8fafc',
    cyDarkBgColor: '#1e293b',
  },
};

export const SkillTreeGraph: React.FC<SkillTreeGraphProps> = ({
  nodes,
  dependencies,
  questions = [],
  nodeStates,
  roiRankings,
  examFrequencyMap,
  onStartPracticeNode,
  onOpenLessonNode,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('mb.structure');
  const [relationFilter, setRelationFilter] = useState<
    'all' | 'prerequisite' | 'cross_course'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'business' | 'industrial' | 'technology' | 'quantitative' | 'conceptual'
  >('all');
  const [layoutMode, setLayoutMode] = useState<'preset' | 'breadthfirst' | 'cose'>('preset');
  const [skillTreeViewTab, setSkillTreeViewTab] = useState<'graph' | 'cards'>('graph');
  const [popoverState, setPopoverState] = useState<{
    visible: boolean;
    nodeId: string;
    x: number;
    y: number;
  }>({
    visible: false,
    nodeId: 'mb.structure',
    x: 24,
    y: 24,
  });

  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyInstanceRef = useRef<Core | null>(null);

  const nodeQuestionCount = useCallback(
    (nodeId: string) => questions.filter((q) => q.nodeId === nodeId).length,
    [questions]
  );

  const matchesCategoryFilter = useCallback(
    (n: KnowledgeNode) => {
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'business') {
        return n.track === 'business' || n.track === 'common' || n.track === 'strategy';
      }
      if (categoryFilter === 'industrial') {
        return (
          n.id.startsWith('ind.') ||
          n.track === 'common' ||
          n.id.startsWith('bus.econ') ||
          n.id.startsWith('bus.math') ||
          n.id.startsWith('bus.islamic') ||
          n.id.startsWith('bus.english')
        );
      }
      if (categoryFilter === 'technology') {
        return (
          n.track === 'technology' ||
          n.track === 'common' ||
          n.id.startsWith('ind.pom') ||
          n.id.startsWith('ind.or')
        );
      }
      if (categoryFilter === 'quantitative') {
        return classifyNodeCourseCategory(n) === 'quantitative';
      }
      if (categoryFilter === 'conceptual') {
        return classifyNodeCourseCategory(n) === 'conceptual';
      }
      return true;
    },
    [categoryFilter]
  );

  const getSafeState = useCallback(
    (nodeId: string): LearnerSixDState =>
      nodeStates[nodeId] || {
        nodeId,
        masteryScore: 0,
        proficiencyProbability: 0,
        memoryStability: 0,
        retrievability: 0,
        speedFluency: 0,
        coverageStatus: 'unseen',
        evidenceCount: 0,
        isUnlockedInFrontier: true,
        hasLeechCard: false,
        rippleAlert: null,
      },
    [nodeStates]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
  const selectedState = getSafeState(selectedNode.id);
  const selectedRoi = roiRankings.find((r) => r.node.id === selectedNode.id);
  const selectedFreq = examFrequencyMap[selectedNode.id];

  const popoverNode =
    nodes.find((n) => n.id === popoverState.nodeId) ?? selectedNode;
  const popoverNodeState = getSafeState(popoverNode.id);
  const popoverNodeRoi = roiRankings.find((r) => r.node.id === popoverNode.id);
  const popoverNodeFreq = examFrequencyMap[popoverNode.id];

  const nodeMap = new Map<string, KnowledgeNode>(nodes.map((n) => [n.id, n]));
  const incomingEdges = dependencies.filter((d) => d.source === selectedNode.id);
  const outgoingEdges = dependencies.filter((d) => d.target === selectedNode.id);

  // Build Cytoscape elements from nodes and dependencies
  const buildCyElements = useCallback((): ElementDefinition[] => {
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');

    const nodeElements: ElementDefinition[] = nodes.map((node) => {
      const st = getSafeState(node.id);
      const freq = examFrequencyMap[node.id];
      const meta = STATUS_META[st.coverageStatus] || STATUS_META.unseen;
      const inFilter = matchesCategoryFilter(node);
      const isSelected = node.id === selectedNodeId;
      const isConnected = dependencies.some(
        (d) =>
          (d.source === selectedNodeId && d.target === node.id) ||
          (d.target === selectedNodeId && d.source === node.id)
      );

      const shortTopic =
        node.topic.length > 24 ? node.topic.slice(0, 23) + '…' : node.topic;
      const shortCourse =
        node.course.length > 20 ? node.course.slice(0, 19) + '…' : node.course;

      const lockTag = st.isUnlockedInFrontier ? 'باز' : 'قفل پیش‌نیاز';
      const highYieldTag = freq?.isHighYieldCritical ? '★ پرتکرار' : shortCourse;
      const label = `${shortTopic}\nتسلط: ${st.masteryScore}٪ | ${meta.shortStatus}\n${highYieldTag} · [${lockTag}]`;

      const borderColor = isSelected
        ? '#2563eb'
        : isConnected
        ? '#f59e0b'
        : !st.isUnlockedInFrontier
        ? isDark
          ? '#475569'
          : '#cbd5e1'
        : meta.cyBorderColor;

      const bgColor = isSelected
        ? isDark
          ? '#1e3a8a'
          : '#dbeafe'
        : !st.isUnlockedInFrontier
        ? isDark
          ? '#0f172a'
          : '#f1f5f9'
        : isDark
        ? meta.cyDarkBgColor
        : meta.cyBgColor;

      const textColor = isDark ? '#f8fafc' : '#0f172a';

      return {
        group: 'nodes',
        data: {
          id: node.id,
          label,
          topic: node.topic,
          course: node.course,
          masteryScore: st.masteryScore,
          coverageStatus: st.coverageStatus,
          unlocked: st.isUnlockedInFrontier ? 'true' : 'false',
          inFilter: inFilter || isSelected ? 'true' : 'false',
          isSelected: isSelected ? 'true' : 'false',
          borderColor,
          bgColor,
          textColor,
          borderWidth: isSelected ? 3.5 : isConnected ? 2.5 : st.masteryScore >= 75 ? 2.5 : 1.5,
          borderStyle: st.isUnlockedInFrontier ? 'solid' : 'dashed',
          nodeOpacity: inFilter || isSelected ? (st.isUnlockedInFrontier ? 1 : 0.72) : 0.25,
        },
        position: {
          x: 150 + node.graphPos.col * 250,
          y: 90 + node.graphPos.layer * 160,
        },
      };
    });

    const edgeElements: ElementDefinition[] = dependencies
      .filter((edge) => relationFilter === 'all' || edge.relation === relationFilter)
      .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
      .map((edge, idx) => {
        const isHighlighted =
          selectedNodeId === edge.source || selectedNodeId === edge.target;
        const lineColor = isHighlighted
          ? '#f59e0b'
          : edge.relation === 'cross_course'
          ? '#a855f7'
          : '#64748b';

        return {
          group: 'edges',
          data: {
            id: `edge-${edge.target}-${edge.source}-${idx}`,
            // Directed from prerequisite (edge.target) -> dependent advanced node (edge.source)
            source: edge.target,
            target: edge.source,
            relation: edge.relation,
            weight: edge.weight,
            lineColor,
            lineStyle: edge.relation === 'cross_course' ? 'dashed' : 'solid',
            lineWidth: isHighlighted ? 3 : 1.8,
            edgeOpacity: isHighlighted ? 1 : 0.65,
          },
        };
      });

    return [...nodeElements, ...edgeElements];
  }, [
    nodes,
    dependencies,
    getSafeState,
    examFrequencyMap,
    matchesCategoryFilter,
    selectedNodeId,
    relationFilter,
  ]);

  // Helper to compute clamped popover coordinates inside the graph container
  const computeClampedPopoverCoords = useCallback(
    (renderedX: number, renderedY: number) => {
      const container = cyContainerRef.current;
      if (!container) {
        return { x: 24, y: 24 };
      }
      const rect = container.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 355;
      const clampedX = Math.max(
        12,
        Math.min(renderedX + 16, Math.max(12, rect.width - popoverWidth - 12))
      );
      const clampedY = Math.max(
        12,
        Math.min(renderedY - 24, Math.max(12, rect.height - popoverHeight - 12))
      );
      return { x: clampedX, y: clampedY };
    },
    []
  );

  // Initialize Cytoscape instance once
  useEffect(() => {
    if (!cyContainerRef.current) return;

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements: buildCyElements(),
      layout: {
        name: 'preset',
        fit: true,
        padding: 36,
      },
      minZoom: 0.35,
      maxZoom: 2.2,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'round-rectangle',
            width: 196,
            height: 68,
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '180px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-family': 'Vazirmatn, Tahoma, sans-serif',
            'font-size': 11,
            'font-weight': 'bold',
            color: 'data(textColor)',
            'background-color': 'data(bgColor)',
            'border-width': (ele: any) => ele.data('borderWidth') ?? 2,
            'border-color': 'data(borderColor)',
            'border-style': (ele: any) => ele.data('borderStyle') ?? 'solid',
            opacity: (ele: any) => ele.data('nodeOpacity') ?? 1,
            'overlay-padding': 6,
            'transition-property':
              'background-color, border-color, border-width, opacity',
            'transition-duration': 180,
          },
        },
        {
          selector: 'node[isSelected = "true"]',
          style: {
            'overlay-color': '#3b82f6',
            'overlay-opacity': 0.12,
          },
        },
        {
          selector: 'edge',
          style: {
            width: (ele: any) => ele.data('lineWidth') ?? 1.8,
            'line-color': 'data(lineColor)',
            'line-style': (ele: any) => ele.data('lineStyle') ?? 'solid',
            'target-arrow-color': 'data(lineColor)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.1,
            opacity: (ele: any) => ele.data('edgeOpacity') ?? 0.65,
          },
        },
      ],
    });

    cy.on('tap', 'node', (evt) => {
      const clickedNode = evt.target;
      const nodeId = clickedNode.id();
      tmaHaptic.selection();
      setSelectedNodeId(nodeId);

      const pos = clickedNode.renderedPosition();
      const coords = computeClampedPopoverCoords(pos.x, pos.y);
      setPopoverState({
        visible: true,
        nodeId,
        x: coords.x,
        y: coords.y,
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setPopoverState((prev) => ({ ...prev, visible: false }));
      }
    });

    cyInstanceRef.current = cy;

    return () => {
      cy.destroy();
      cyInstanceRef.current = null;
    };
  }, []);

  // Synchronize elements and visual states when props or filters change
  useEffect(() => {
    const cy = cyInstanceRef.current;
    if (!cy) return;

    const updatedElements = buildCyElements();
    cy.batch(() => {
      // Update existing nodes or add new ones
      const nodeElements = updatedElements.filter((el) => el.group === 'nodes');
      const edgeElements = updatedElements.filter((el) => el.group === 'edges');

      nodeElements.forEach((nEl) => {
        const id = nEl.data.id as string;
        const existing = cy.getElementById(id);
        if (existing.length > 0) {
          existing.data(nEl.data);
          if (layoutMode === 'preset' && nEl.position) {
            existing.position(nEl.position);
          }
        } else {
          cy.add(nEl);
        }
      });

      // Remove stale nodes if any
      const validIds = new Set(nodeElements.map((n) => n.data.id));
      cy.nodes().forEach((n) => {
        if (!validIds.has(n.id())) {
          cy.remove(n);
        }
      });

      // Rebuild edges cleanly for relationFilter changes
      cy.edges().remove();
      cy.add(edgeElements);
    });
  }, [buildCyElements, layoutMode]);

  // Apply layout mode when switched
  const handleRunLayout = useCallback(
    (mode: 'preset' | 'breadthfirst' | 'cose') => {
      setLayoutMode(mode);
      const cy = cyInstanceRef.current;
      if (!cy) return;

      if (mode === 'preset') {
        nodes.forEach((node) => {
          const el = cy.getElementById(node.id);
          if (el.length > 0) {
            el.position({
              x: 150 + node.graphPos.col * 250,
              y: 90 + node.graphPos.layer * 160,
            });
          }
        });
        cy.fit(undefined, 36);
      } else if (mode === 'breadthfirst') {
        cy.layout({
          name: 'breadthfirst',
          directed: true,
          padding: 40,
          spacingFactor: 1.25,
          animate: true,
          animationDuration: 300,
        }).run();
      } else {
        cy.layout({
          name: 'cose',
          padding: 40,
          animate: true,
          animationDuration: 350,
          nodeRepulsion: () => 18000,
          idealEdgeLength: () => 140,
        }).run();
      }
    },
    [nodes]
  );

  const handleSelectAndOpenPopover = (nodeId: string) => {
    tmaHaptic.selection();
    setSelectedNodeId(nodeId);
    const cy = cyInstanceRef.current;
    if (cy) {
      const el = cy.getElementById(nodeId);
      if (el.length > 0) {
        const pos = el.renderedPosition();
        const coords = computeClampedPopoverCoords(pos.x, pos.y);
        setPopoverState({
          visible: true,
          nodeId,
          x: coords.x,
          y: coords.y,
        });
        return;
      }
    }
    setPopoverState({
      visible: true,
      nodeId,
      x: 24,
      y: 24,
    });
  };

  return (
    <div className="bento-grid items-start">
      {/* بوم گراف تعاملی درخت مهارت با Cytoscape.js (8 ستون بنتو) */}
      <div className="bento-span-8 bento-card glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200/70 dark:border-slate-800/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                درخت مهارت، مرز دانش (Knowledge Frontier) و رادار کنکور ({nodes.length} گره)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              گراف تعاملی Node-Link مبتنی بر Cytoscape.js — روی هر گره کلیک کنید تا پاپ‌آور وضعیت ۶بعدی (6D Learner State) و دکمه «شروع تمرین (Start Practice)» باز شود.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            {/* تب انتخاب نما: نمای گراف تعاملی Cytoscape در برابر فهرست کارتی مباحث */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={skillTreeViewTab === 'graph'}
                onClick={() => {
                  tmaHaptic.selection();
                  setSkillTreeViewTab('graph');
                  setTimeout(() => {
                    const cy = cyInstanceRef.current;
                    if (cy) {
                      cy.resize();
                      cy.fit(undefined, 36);
                    }
                  }, 30);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  skillTreeViewTab === 'graph'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>نمای گراف تعاملی</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={skillTreeViewTab === 'cards'}
                onClick={() => {
                  tmaHaptic.selection();
                  setSkillTreeViewTab('cards');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  skillTreeViewTab === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>فهرست کارتی مباحث ({nodes.filter(matchesCategoryFilter).length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `همه (${nodes.length})` },
                { id: 'business', label: 'بازرگانی' },
                { id: 'industrial', label: 'صنعتی' },
                { id: 'technology', label: 'فناوری' },
                { id: 'quantitative', label: 'کمی و محاسباتی' },
                { id: 'conceptual', label: 'مفهومی و تئوری' },
              ].map((cf) => (
              <button
                key={cf.id}
                type="button"
                onClick={() => {
                  tmaHaptic.selection();
                  setCategoryFilter(cf.id as any);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                  categoryFilter === cf.id
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cf.label}
              </button>
            ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  tmaHaptic.selection();
                  setRelationFilter('all');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  relationFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                همه یال‌ها ({dependencies.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  tmaHaptic.selection();
                  setRelationFilter('prerequisite');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  relationFilter === 'prerequisite'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                پیش‌نیاز مستقیم (FIRe)
              </button>
              <button
                type="button"
                onClick={() => {
                  tmaHaptic.selection();
                  setRelationFilter('cross_course');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  relationFilter === 'cross_course'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                پل بین‌درسی
              </button>
            </div>

            {/* کنترل‌های چیدمان و بزرگ‌نمایی Cytoscape */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl">
              <button
                type="button"
                onClick={() => handleRunLayout('preset')}
                className={`px-2.5 py-1 text-[11px] rounded-lg cursor-pointer transition-colors ${
                  layoutMode === 'preset'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
                title="چیدمان لایه‌ای کنکور (DAG)"
              >
                لایه‌ای (DAG)
              </button>
              <button
                type="button"
                onClick={() => handleRunLayout('breadthfirst')}
                className={`px-2.5 py-1 text-[11px] rounded-lg cursor-pointer transition-colors ${
                  layoutMode === 'breadthfirst'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
                title="چیدمان درختی سلسله‌مراتبی"
              >
                درختی
              </button>
              <button
                type="button"
                onClick={() => handleRunLayout('cose')}
                className={`px-2.5 py-1 text-[11px] rounded-lg cursor-pointer transition-colors ${
                  layoutMode === 'cose'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
                title="چیدمان شبکه‌ای نیرو-محور (Force-Directed)"
              >
                شبکه‌ای
              </button>
              <span className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={() => {
                  const cy = cyInstanceRef.current;
                  if (cy) cy.zoom(cy.zoom() * 1.2);
                }}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                title="بزرگ‌نمایی (Zoom In)"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const cy = cyInstanceRef.current;
                  if (cy) cy.zoom(cy.zoom() * 0.8);
                }}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                title="کوچک‌نمایی (Zoom Out)"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const cy = cyInstanceRef.current;
                  if (cy) cy.fit(undefined, 36);
                }}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                title="نمایش کل گراف (Fit to Screen)"
                aria-label="Fit Graph"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const cy = cyInstanceRef.current;
                  if (cy) {
                    const el = cy.getElementById(selectedNodeId);
                    if (el.length > 0) {
                      cy.center(el);
                    }
                  }
                }}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                title="تمرکز روی گره انتخاب‌شده"
                aria-label="Center Selected Node"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* راهنمای بصری و بوم Cytoscape.js (نمایش در تب گراف) */}
        <div className={skillTreeViewTab === 'graph' ? 'block' : 'hidden'}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 mb-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>★ پرتکرار کنکور (≥۶ سال تکرار)</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>کادر سبز: تثبیت/اثبات‌شده</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-500" />
                <span>کادر کهربایی: آماده اثبات ۱۴۰۴</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5 text-blue-500" />
                <span>خط ممتد: باز در مرز دانش (Unlocked)</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>خط‌چین: قفل پیش‌نیاز (Locked)</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {LAYER_TITLES[selectedNode.graphPos.layer] ?? LAYER_TITLES[0]}
            </span>
          </div>

          {/* بوم Cytoscape.js به همراه پاپ‌آور تعاملی وضعیت ۶بعدی (6D Learner State Popover) */}
          <div className="relative w-full h-[580px] rounded-xl bg-slate-50/90 dark:bg-[#0d1322] border border-slate-200/70 dark:border-slate-800/80 overflow-hidden">
          <div
            ref={cyContainerRef}
            className="w-full h-full select-none"
            role="region"
            aria-label="Cytoscape Knowledge Graph Node-Link Diagram"
          />

          {/* پاپ‌آور ۶بعدی گره هنگام کلیک روی گره در Cytoscape */}
          {popoverState.visible && (
            <div
              role="dialog"
              aria-label={`6D Learner State Popover - ${popoverNode.topic}`}
              style={{
                left: `${popoverState.x}px`,
                top: `${popoverState.y}px`,
              }}
              className="absolute z-30 w-80 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-blue-500/40 dark:border-blue-400/40 shadow-xl p-4 text-xs transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{popoverNode.course}</span>
                    <span>·</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        popoverNodeState.isUnlockedInFrontier
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {popoverNodeState.isUnlockedInFrontier ? (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>باز (Unlocked)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>قفل (Locked)</span>
                        </>
                      )}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                    {popoverNode.topic}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPopoverState((prev) => ({ ...prev, visible: false }))
                  }
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="بستن پاپ‌آور"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-2.5 flex items-center justify-between text-[11px] bg-slate-100/80 dark:bg-slate-800/70 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  وضعیت ۶بعدی یادگیرنده (6D Learner State):
                </span>
                <span
                  className={`font-bold ${
                    STATUS_META[popoverNodeState.coverageStatus].badgeTextClass
                  }`}
                >
                  {STATUS_META[popoverNodeState.coverageStatus].shortStatus}
                </span>
              </div>

              {/* نمایش هر ۶ بعد یادگیرنده در پاپ‌آور */}
              <div className="grid grid-cols-2 gap-1.5 mb-3 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۱. تسلط مفهومی (Mastery)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {popoverNodeState.masteryScore}٪ (P={Math.round(popoverNodeState.proficiencyProbability * 100)}٪)
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۲. پایداری حافظه (Stability)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {popoverNodeState.memoryStability} روز (FSRS)
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۳. بازیابی (Retrievability)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {Math.round(popoverNodeState.retrievability * 100)}٪
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۴. سرعت و روانی (Fluency)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {popoverNodeState.speedFluency}٪
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۵. شواهد و تست‌ها (Evidence)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {popoverNodeState.evidenceCount} شاهد · {nodeQuestionCount(popoverNode.id)} تست
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    ۶. ارزش کنکوری (ROI)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {popoverNodeRoi?.roiScore ?? 75}/100 · ضریب {popoverNode.examCoefficient}
                  </div>
                </div>
              </div>

              {popoverNodeFreq && (
                <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>تکرار در کنکور: {popoverNodeFreq.appearanceCount} دوره</span>
                  <span className="font-mono tabular-nums">
                    {popoverNodeFreq.yearsAppeared.slice(0, 4).join('، ')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    tmaHaptic.impact('medium');
                    setPopoverState((prev) => ({ ...prev, visible: false }));
                    onStartPracticeNode(
                      popoverNode.id,
                      popoverNodeState.coverageStatus === 'needs_proof'
                        ? 'proof'
                        : 'practice'
                    );
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>شروع تمرین (Start Practice)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    tmaHaptic.impact('light');
                    setPopoverState((prev) => ({ ...prev, visible: false }));
                    onOpenLessonNode(popoverNode.id);
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span>درسنامه</span>
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* تب فهرست کارتی مباحث فیلترشده (جدا از گراف برای جلوگیری از شلوغی زیر بوم) */}
        {skillTreeViewTab === 'cards' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                فهرست مباحث فیلترشده ({nodes.filter(matchesCategoryFilter).length} مبحث از {nodes.length} گره درخت دانشی)
              </span>
              <span>کلیک روی هر کارت = مشاهده جزئیات ۶بعدی در بازرس سمت چپ</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
            {nodes.filter(matchesCategoryFilter).map((n) => {
              const st = getSafeState(n.id);
              const qCount = nodeQuestionCount(n.id);
              const freq = examFrequencyMap[n.id];
              const isSel = selectedNodeId === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => handleSelectAndOpenPopover(n.id)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSel
                      ? 'bg-blue-500/10 border-blue-500 text-slate-900 dark:text-white'
                      : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{n.course}</span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 tabular-nums">
                        {st.isUnlockedInFrontier ? (
                          <Unlock className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Lock className="w-3 h-3 text-slate-400" />
                        )}
                        {st.masteryScore}٪
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                      {n.topic}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {qCount} تست · {freq?.appearanceCount ?? n.examYearsAppeared.length} دوره کنکور
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLessonNode(n.id);
                        }}
                        className="px-2 py-0.5 rounded bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 font-bold transition-colors cursor-pointer"
                      >
                        درسنامه
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartPracticeNode(n.id, 'practice');
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:text-emerald-400 font-bold transition-colors cursor-pointer"
                      >
                        تست
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* بازرس ۶بعدی گره انتخاب‌شده (Node 6D Inspector) (4 ستون بنتو) */}
      <div className="bento-span-4 bento-card glass-panel p-5 sticky top-20">
        <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-slate-200/70 dark:border-slate-800/80">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>{selectedNode.course}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedNode.chapter}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {selectedNode.topic}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">
            {selectedNode.id}
          </span>
        </div>

        {/* رادار تکرار در کنکور دکتری */}
        {selectedFreq && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-1">
            <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{selectedFreq.importanceBadge}</span>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300">
              سال‌های طرح سؤال:{' '}
              <strong className="tabular-nums">
                {selectedFreq.yearsAppeared.join('، ')}
              </strong>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              منبع: {selectedNode.sourceBookCitation}
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            وضعیت مرز دانش:
          </span>
          <span
            className={`font-bold flex items-center gap-1.5 ${STATUS_META[selectedState.coverageStatus].badgeTextClass}`}
          >
            {!selectedState.isUnlockedInFrontier ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>قفل پیش‌نیاز</span>
              </>
            ) : selectedState.hasLeechCard ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>کارت چغر (Leech)</span>
              </>
            ) : selectedState.rippleAlert === 'probe_queued' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>تست تشخیصی در صف</span>
              </>
            ) : (
              <span>{STATUS_META[selectedState.coverageStatus].label}</span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>۱. احتمال تسلط مفهومی</span>
              <Activity className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {selectedState.masteryScore}٪
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              امتیاز درسنامه:{' '}
              {selectedState.lastLessonSelfRating
                ? `${selectedState.lastLessonSelfRating} از ۵`
                : 'ثبت‌نشده'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>۲. پایداری حافظه FSRS</span>
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {selectedState.memoryStability} روز
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              بازیابی فعلی: {Math.round(selectedState.retrievability * 100)}٪
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>۳. بازده سرمایه‌گذاری (ROI)</span>
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {selectedRoi?.roiScore ?? 75} از ۱۰۰
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              ضریب کنکور: {selectedNode.examCoefficient} (تخصصی)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>۴. شواهد و سرعت</span>
              <Layers className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {selectedState.evidenceCount} شاهد
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              روانی پاسخ: {selectedState.speedFluency}٪
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5 text-xs">
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              پیش‌نیازهای مستقیم (دریافت‌کننده اعتبار FIRe از این مبحث):
            </h4>
            {incomingEdges.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                این گره جزو مباحث پایه (لایه ۰) است و پیش‌نیاز قبلی ندارد.
              </p>
            ) : (
              <div className="space-y-1.5">
                {incomingEdges.map((e) => {
                  const target = nodeMap.get(e.target);
                  if (!target) return null;
                  return (
                    <button
                      key={e.target}
                      type="button"
                      onClick={() => handleSelectAndOpenPopover(target.id)}
                      className="w-full text-right p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        ← {target.topic}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                        {nodeStates[target.id]?.masteryScore}٪
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {outgoingEdges.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                مباحث پیشرفته‌ای که پس از تسلط بر این گره باز می‌شوند:
              </h4>
              <div className="space-y-1.5">
                {outgoingEdges.map((e) => {
                  const dep = nodeMap.get(e.source);
                  if (!dep) return null;
                  return (
                    <button
                      key={e.source}
                      type="button"
                      onClick={() => handleSelectAndOpenPopover(dep.id)}
                      className="w-full text-right p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        ↳ {dep.topic}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                        {nodeStates[dep.id]?.masteryScore}٪
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* دکمه‌های عملیاتی روی گره */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              tmaHaptic.impact('light');
              onOpenLessonNode(selectedNode.id);
            }}
            className="min-h-[42px] w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors duration-200 shadow-xs cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>۱. مطالعه درسنامه گام‌به‌گام و ثبت امتیاز ۱ تا ۵</span>
          </button>

          {selectedState.coverageStatus === 'needs_proof' ? (
            <button
              type="button"
              onClick={() => {
                tmaHaptic.impact('heavy');
                onStartPracticeNode(selectedNode.id, 'proof');
              }}
              className="min-h-[42px] w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors duration-200 shadow-xs cursor-pointer"
            >
              <Target className="w-4 h-4" />
              <span>۲. شروع تست قرنطینه ۱۴۰۴ (Start Practice - اثبات تسلط)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                tmaHaptic.impact('medium');
                onStartPracticeNode(selectedNode.id, 'practice');
              }}
              className="min-h-[42px] w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer"
            >
              <Play className="w-4 h-4 text-blue-500" />
              <span>۲. شروع تمرین و حل تست استاندارد (Start Practice)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

