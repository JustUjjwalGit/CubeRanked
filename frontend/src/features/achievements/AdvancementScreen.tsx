import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type {
  AchievementCategory,
  AchievementDef,
  AchievementsData,
  UserAchievementEntry,
  AchievementRarity,
} from "./achievement.types";
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_ICONS } from "./achievement.types";
import { fetchAchievements } from "../../api/achievements";

interface AdvancementScreenProps {
  onClose: () => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  achievement: AchievementDef;
  entry?: UserAchievementEntry;
  unlocked: boolean;
  isHidden: boolean;
}

interface LayoutLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  unlocked: boolean;
}

const NODE_W = 64;
const NODE_H = 64;
const COL_GAP = 130;
const ROW_GAP = 90;
const PADDING_X = 120;
const PADDING_Y = 80;

const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: "rgba(148,163,184,0.4)",
  rare: "rgba(96,165,250,0.6)",
  epic: "rgba(167,139,250,0.6)",
  legendary: "rgba(250,204,21,0.7)",
};

const RARITY_BG: Record<AchievementRarity, string> = {
  common: "rgba(148,163,184,0.08)",
  rare: "rgba(96,165,250,0.10)",
  epic: "rgba(167,139,250,0.10)",
  legendary: "rgba(250,204,21,0.10)",
};

const ICON_MAP: Record<string, string> = {
  "cube": "🧊",
  "stopwatch": "⏱️",
  "lightning": "⚡",
  "bolt": "⚡",
  "cube-stack": "📦",
  "layers": "📚",
  "zap": "⚡",
  "flame": "🔥",
  "gold-bolt": "⚡",
  "trophy": "🏆",
  "fire-trophy": "🔥",
  "bronze-medal": "🥉",
  "silver-medal": "🥈",
  "gold-medal": "🥇",
  "user-plus": "➕",
  "handshake": "🤝",
  "eye": "👁️",
  "cake": "🎂",
  "moon": "🌙",
  "phoenix": "🦅",
  "google": "G",
};

export function AdvancementScreen({ onClose }: AdvancementScreenProps) {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>("BEGINNER");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAchievements()
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.achievements.map((a) => a.category));
    return Array.from(cats).sort((a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b]);
  }, [data]);

  const { nodes, lines } = useMemo(() => {
    const result: { nodes: LayoutNode[]; lines: LayoutLine[] } = { nodes: [], lines: [] };
    if (!data) return result;

    const catAchievements = data.achievements
      .filter((a) => a.category === selectedCategory)
      .sort((a, b) => a.order - b.order);

    const roots = catAchievements.filter((a) => !a.parentId);
    const depthMap = new Map<string, number>();
    const colCounts = new Map<number, number>();

    function assignDepth(id: string, depth: number) {
      depthMap.set(id, depth);
      const children = catAchievements.filter((a) => a.parentId === id);
      for (const child of children) assignDepth(child.id, depth + 1);
    }
    for (const root of roots) assignDepth(root.id, 0);

    const rowsAtDepth = new Map<number, number>();
    const rowIndex = new Map<string, number>();

    function assignRow(id: string) {
      const depth = depthMap.get(id) ?? 0;
      const current = rowsAtDepth.get(depth) ?? 0;
      rowsAtDepth.set(depth, current + 1);
      rowIndex.set(id, current);
      const children = catAchievements.filter((a) => a.parentId === id);
      for (const child of children) assignRow(child.id);
    }
    for (const root of roots) assignRow(root.id);

    const maxCols = Math.max(1, ...Array.from(rowsAtDepth.values()));
    const totalWidth = (maxCols - 1) * COL_GAP;
    const totalHeight = (Array.from(rowsAtDepth.keys()).length - 1) * ROW_GAP;

    for (const ach of catAchievements) {
      const depth = depthMap.get(ach.id) ?? 0;
      const row = rowIndex.get(ach.id) ?? 0;
      const totalInDepth = rowsAtDepth.get(depth) ?? 1;
      const yOffset = -(totalInDepth - 1) * ROW_GAP / 2;
      const x = depth * COL_GAP;
      const y = yOffset + row * ROW_GAP;
      const entry = data.progress.find((p) => p.achievementId === ach.id);
      result.nodes.push({
        id: ach.id,
        x, y,
        achievement: ach,
        entry,
        unlocked: entry?.unlockedAt != null,
        isHidden: !!ach.hidden && !entry?.unlockedAt,
      });
    }

    for (const ach of catAchievements) {
      if (!ach.parentId) continue;
      const parent = catAchievements.find((a) => a.id === ach.parentId);
      if (!parent) continue;
      const pNode = result.nodes.find((n) => n.id === parent.id);
      const cNode = result.nodes.find((n) => n.id === ach.id);
      if (pNode && cNode) {
        result.lines.push({
          from: { x: pNode.x + NODE_W / 2, y: pNode.y + NODE_H / 2 },
          to: { x: cNode.x - NODE_W / 2, y: cNode.y + NODE_H / 2 },
          unlocked: pNode.unlocked && cNode.unlocked,
        });
      }
    }

    return result;
  }, [data, selectedCategory]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return nodes.find((n) => n.id === selectedId) ?? null;
  }, [selectedId, nodes]);

  const centerView = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.max(0.3, Math.min(3, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setOffsetStart({ x: offset.x, y: offset.y });
    }
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset({ x: offsetStart.x + dx, y: offsetStart.y + dy });
    }
  }, [dragging, dragStart, offsetStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const target = (e.target as HTMLElement).closest("[data-ach-id]");
    if (target) {
      setSelectedId(target.getAttribute("data-ach-id"));
    } else {
      setSelectedId(null);
    }
  }, [dragging]);

  const categoryProgress = useMemo(() => {
    if (!data) return new Map<AchievementCategory, { unlocked: number; total: number; earned: number; totalPts: number }>();
    const map = new Map<AchievementCategory, { unlocked: number; total: number; earned: number; totalPts: number }>();
    for (const cat of categories) {
      const catAchievements = data.achievements.filter((a) => a.category === cat);
      const total = catAchievements.length;
      const unlocked = catAchievements.filter((a) => {
        const entry = data.progress.find((p) => p.achievementId === a.id);
        return entry?.unlockedAt != null;
      }).length;
      const earned = catAchievements
        .filter((a) => {
          const entry = data.progress.find((p) => p.achievementId === a.id);
          return entry?.unlockedAt != null;
        })
        .reduce((s, a) => s + a.points, 0);
      const totalPts = catAchievements.reduce((s, a) => s + a.points, 0);
      map.set(cat, { unlocked, total, earned, totalPts });
    }
    return map;
  }, [data, categories]);

  return (
    <motion.div
      className="adv-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="adv-screen">
        {/* Header */}
        <div className="adv-header">
          <div className="adv-header-left">
            <h2 className="adv-title">Advancements</h2>
            <span className="adv-points">
              {data ? `${data.earnedPoints} / ${data.totalPoints} pts` : ""}
            </span>
          </div>
          <div className="adv-header-center">
            <button className="adv-reset-btn" onClick={centerView} type="button" title="Reset View">
              ⊞
            </button>
          </div>
          <button className="adv-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {/* Tab bar */}
        <nav className="adv-tabs">
          {categories.map((cat) => {
            const prog = categoryProgress.get(cat);
            const pct = prog && prog.total > 0 ? Math.round((prog.unlocked / prog.total) * 100) : 0;
            return (
              <button
                key={cat}
                className={`adv-tab ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => { setSelectedCategory(cat); setSelectedId(null); }}
                type="button"
              >
                <span className="adv-tab-icon">{CATEGORY_ICONS[cat]}</span>
                <span className="adv-tab-label">{CATEGORY_LABELS[cat]}</span>
                <span className="adv-tab-pct">{pct}%</span>
              </button>
            );
          })}
        </nav>

        {/* Canvas */}
        <div className="adv-canvas-wrapper" ref={canvasRef}>
          {loading ? (
            <div className="adv-loading">Loading...</div>
          ) : !data ? (
            <div className="adv-loading">Sign in to track achievements</div>
          ) : (
            <div
              className="adv-canvas"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
            >
              {/* Grid background */}
              <div className="adv-grid">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={`gv-${i}`} className="adv-grid-line-v" style={{ left: `${i * 80}px` }} />
                ))}
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={`gh-${i}`} className="adv-grid-line-h" style={{ top: `${i * 80}px` }} />
                ))}
              </div>

              {/* Connection lines */}
              <svg className="adv-lines-svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                {lines.map((line, i) => (
                  <line
                    key={i}
                    x1={line.from.x}
                    y1={line.from.y}
                    x2={line.to.x}
                    y2={line.to.y}
                    stroke={line.unlocked ? "rgba(167,139,250,0.5)" : "rgba(148,163,184,0.12)"}
                    strokeWidth={line.unlocked ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              {/* Nodes */}
              {nodes.map((node) => {
                const rarityColor = RARITY_COLORS[node.achievement.rarity];
                return (
                  <div
                    key={node.id}
                    data-ach-id={node.id}
                    className={`adv-node ${node.unlocked ? "unlocked" : "locked"} ${selectedId === node.id ? "selected" : ""} rarity-${node.achievement.rarity}`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: NODE_W,
                      height: NODE_H,
                      borderColor: node.unlocked ? rarityColor : "rgba(148,163,184,0.15)",
                      background: node.unlocked ? RARITY_BG[node.achievement.rarity] : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <span className="adv-node-icon">
                      {node.isHidden ? "?" : ICON_MAP[node.achievement.icon] ?? "★"}
                    </span>
                    <span className="adv-node-label">
                      {node.isHidden ? "???" : node.achievement.name}
                    </span>
                    {node.unlocked && <span className="adv-node-check">✓</span>}
                  </div>
                );
              })}

              {/* Spacer for scrolling */}
              <div style={{ width: 2000, height: 2000, pointerEvents: "none" }} />
            </div>
          )}
        </div>

        {/* Detail popup */}
        <AnimatePresence>
          {selectedNode ? (
            <motion.div
              className="adv-detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              <div className="adv-detail-header">
                <div className={`adv-detail-icon rarity-${selectedNode.achievement.rarity}`}>
                  {selectedNode.isHidden ? "?" : ICON_MAP[selectedNode.achievement.icon] ?? "★"}
                </div>
                <div className="adv-detail-titles">
                  <strong className="adv-detail-name">
                    {selectedNode.isHidden ? "???" : selectedNode.achievement.name}
                  </strong>
                  <span className="adv-detail-cat">
                    {CATEGORY_LABELS[selectedNode.achievement.category]}
                    <span className={`adv-detail-rarity rarity-${selectedNode.achievement.rarity}`}>
                      {selectedNode.achievement.rarity}
                    </span>
                  </span>
                </div>
                <span className="adv-detail-pts">+{selectedNode.achievement.points}pts</span>
              </div>
              <p className="adv-detail-desc">
                {selectedNode.isHidden
                  ? "??? Complete the requirements to reveal this achievement."
                  : selectedNode.achievement.description}
              </p>
              {selectedNode.entry && !selectedNode.unlocked && selectedNode.entry.progress > 0 ? (
                <div className="adv-detail-progress">
                  <div className="adv-progress-bar">
                    <div className="adv-progress-fill" style={{ width: `${Math.round(selectedNode.entry.progress * 100)}%` }} />
                  </div>
                  {selectedNode.entry.progressTarget > 1 && (
                    <span className="adv-progress-text">
                      {Math.round(selectedNode.entry.progressValue)}/{selectedNode.entry.progressTarget}
                    </span>
                  )}
                </div>
              ) : null}
              {selectedNode.unlocked && selectedNode.entry?.unlockedAt ? (
                <div className="adv-detail-date">
                  Unlocked {new Date(selectedNode.entry.unlockedAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
