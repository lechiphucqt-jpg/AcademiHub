import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Book, DetailedContent, Lesson, SelectionPath, Unit } from '../types/academic';

interface ConceptMapViewProps {
  books: Book[];
  onNavigateToContent: (path: SelectionPath) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

interface GraphNode {
  id: string;
  label: string;
  kind: 'book' | 'unit' | 'lesson' | 'content';
  contentType?: DetailedContent['type'];
  path: SelectionPath;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  description?: string;
  extra?: string;
}

interface GraphLink {
  sourceId: string;
  targetId: string;
}

export default function ConceptMapView({
  books,
  onNavigateToContent,
  onNotify,
}: ConceptMapViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Filter state
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeNode, setActiveNode] = useState<GraphNode | null>(null);

  // Transform (Pan / Zoom)
  const [pan, setPan] = useState({ x: 300, y: 220 });
  const [zoom, setZoom] = useState(1);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Dragging individual node
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Build Nodes & Links
  const { initialNodes, initialLinks } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const targetBooks = selectedBookId === 'all' ? books : books.filter((b) => b.id === selectedBookId);

    targetBooks.forEach((book, bIdx) => {
      const bookAngle = (bIdx / Math.max(1, targetBooks.length)) * 2 * Math.PI;
      const bookDist = 180;
      const bX = Math.cos(bookAngle) * bookDist;
      const bY = Math.sin(bookAngle) * bookDist;

      const bookNodeId = `node-${book.id}`;
      nodes.push({
        id: bookNodeId,
        label: book.title,
        kind: 'book',
        path: { bookId: book.id, unitId: null, lessonId: null, contentId: null },
        x: bX,
        y: bY,
        vx: 0,
        vy: 0,
        radius: 28,
        color: '#2563EB',
        description: book.description,
        extra: `${book.subject} • ${book.gradeLevel}`,
      });

      book.units.forEach((unit, uIdx) => {
        const uNodeId = `node-${unit.id}`;
        const uAngle = bookAngle + (uIdx - (book.units.length - 1) / 2) * 0.45;
        const uDist = bookDist + 140;
        const uX = Math.cos(uAngle) * uDist;
        const uY = Math.sin(uAngle) * uDist;

        nodes.push({
          id: uNodeId,
          label: unit.title,
          kind: 'unit',
          path: { bookId: book.id, unitId: unit.id, lessonId: null, contentId: null },
          x: uX,
          y: uY,
          vx: 0,
          vy: 0,
          radius: 22,
          color: '#0D9488',
          description: unit.description,
          extra: `Chương ${unit.order}`,
        });

        links.push({ sourceId: bookNodeId, targetId: uNodeId });

        unit.lessons.forEach((lesson, lIdx) => {
          const lNodeId = `node-${lesson.id}`;
          const lAngle = uAngle + (lIdx - (unit.lessons.length - 1) / 2) * 0.35;
          const lDist = uDist + 130;
          const lX = Math.cos(lAngle) * lDist;
          const lY = Math.sin(lAngle) * lDist;

          nodes.push({
            id: lNodeId,
            label: lesson.title,
            kind: 'lesson',
            path: { bookId: book.id, unitId: unit.id, lessonId: lesson.id, contentId: null },
            x: lX,
            y: lY,
            vx: 0,
            vy: 0,
            radius: 17,
            color: '#7C3AED',
            description: lesson.summary,
            extra: `${lesson.contents.length} học liệu`,
          });

          links.push({ sourceId: uNodeId, targetId: lNodeId });

          // Content leaves
          lesson.contents.forEach((content, cIdx) => {
            const cNodeId = `node-${content.id}`;
            const cAngle = lAngle + (cIdx - (lesson.contents.length - 1) / 2) * 0.25;
            const cDist = lDist + 95;

            const cColor =
              content.type === 'interactive-html'
                ? '#EA580C'
                : content.type === 'quiz'
                ? '#16A34A'
                : content.type === 'game'
                ? '#D97706'
                : content.type === 'simulation'
                ? '#4F46E5'
                : '#0284C7';

            nodes.push({
              id: cNodeId,
              label: content.title,
              kind: 'content',
              contentType: content.type,
              path: { bookId: book.id, unitId: unit.id, lessonId: lesson.id, contentId: content.id },
              x: Math.cos(cAngle) * cDist,
              y: Math.sin(cAngle) * cDist,
              vx: 0,
              vy: 0,
              radius: 12,
              color: cColor,
              description: content.description,
              extra: `${content.type.toUpperCase()} • ${content.estimatedMinutes}m`,
            });

            links.push({ sourceId: lNodeId, targetId: cNodeId });
          });
        });
      });
    });

    return { initialNodes: nodes, initialLinks: links };
  }, [books, selectedBookId]);

  const [simNodes, setSimNodes] = useState<GraphNode[]>(initialNodes);

  useEffect(() => {
    setSimNodes(initialNodes);
  }, [initialNodes]);

  // Handle Canvas Dragging (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    setIsDraggingCanvas(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    } else if (draggingNodeId) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;

      setSimNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: rawX, y: rawY } : n))
      );
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.4), 2.5));
  };

  // Node Map for links
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  // Filtered nodes based on search
  const matchesSearch = (n: GraphNode) => {
    if (!searchTerm.trim()) return true;
    return n.label.toLowerCase().includes(searchTerm.toLowerCase());
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Top Filter Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex flex-wrap items-center justify-between gap-4 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Bản Đồ Mạng Tri Thức (Concept Map)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trực quan hóa cấu trúc liên kết học thuật 4 tầng
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Book dropdown */}
          <select
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden"
          >
            <option value="all">Tất cả giáo trình ({books.length})</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.subject})
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm bài học, khái niệm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-48 focus:outline-hidden"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 300, y: 220 });
                setZoom(1);
              }}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              title="Đặt lại góc nhìn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Draw Links */}
            {initialLinks.map((link, lIdx) => {
              const src = nodeMap.get(link.sourceId);
              const tgt = nodeMap.get(link.targetId);
              if (!src || !tgt) return null;
              return (
                <line
                  key={`link-${lIdx}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray={tgt.kind === 'content' ? '3 3' : 'none'}
                  className="transition-colors dark:stroke-slate-800"
                />
              );
            })}

            {/* Draw Nodes */}
            {simNodes.map((node) => {
              const isMatch = matchesSearch(node);
              const isSelected = activeNode?.id === node.id;
              const opacity = isMatch ? 1 : 0.2;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  style={{ opacity }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNodeId(node.id);
                  }}
                  onClick={() => setActiveNode(node)}
                >
                  {/* Glow circle if selected */}
                  {isSelected && (
                    <circle
                      r={node.radius + 6}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={3}
                      strokeDasharray="4 2"
                      className="animate-spin"
                      style={{ transformOrigin: '0 0', animationDuration: '6s' }}
                    />
                  )}

                  <circle
                    r={node.radius}
                    fill={node.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="shadow-md hover:scale-110 transition-transform"
                  />

                  {/* Icon or Initial */}
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#ffffff"
                    fontSize={node.radius > 18 ? 11 : 9}
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {node.kind === 'book'
                      ? 'SÁCH'
                      : node.kind === 'unit'
                      ? 'CHƯƠNG'
                      : node.kind === 'lesson'
                      ? 'BÀI'
                      : node.contentType === 'quiz'
                      ? 'QUIZ'
                      : node.contentType === 'game'
                      ? 'GAME'
                      : node.contentType === 'simulation'
                      ? 'SIM'
                      : 'HTML'}
                  </text>

                  {/* Label under node */}
                  <text
                    textAnchor="middle"
                    dy={node.radius + 14}
                    fill="currentColor"
                    fontSize={11}
                    fontWeight="600"
                    className="fill-slate-700 dark:fill-slate-300 select-none pointer-events-none"
                  >
                    {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-xs flex flex-col gap-1.5 z-10 pointer-events-none">
          <span className="font-bold text-slate-800 dark:text-slate-200">Chú giải màu sắc:</span>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full bg-blue-600" /> Sách giáo trình
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full bg-teal-600" /> Chương / Unit
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full bg-purple-600" /> Bài học / Lesson
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full bg-orange-600" /> HTML5 / Quiz / Minigame
          </div>
        </div>

        {/* Inspector Card for Selected Node */}
        {activeNode && (
          <div className="absolute top-4 right-4 w-80 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3 z-10 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between">
              <span
                className="px-2 py-0.5 text-[10px] font-bold rounded-md text-white uppercase tracking-wider"
                style={{ backgroundColor: activeNode.color }}
              >
                {activeNode.kind}
              </span>
              <button
                type="button"
                onClick={() => setActiveNode(null)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {activeNode.label}
            </h3>

            {activeNode.extra && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {activeNode.extra}
              </p>
            )}

            {activeNode.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                {activeNode.description}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                onNavigateToContent(activeNode.path);
                onNotify(`Đã chuyển tới "${activeNode.label}".`, 'success');
              }}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở bài học này ngay</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
