'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Share2, ZoomIn, ZoomOut, RotateCcw, Filter, Search, Info, Cpu, Network } from 'lucide-react';
import { API_URL as API_BASE_URL } from '../../config';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  category: string;
  category_label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  degree: number;
  radius: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight: number;
}

interface GraphData {
  title?: string;
  total_nodes: number;
  total_edges: number;
  nodes: GraphNode[];
  links: GraphLink[];
  categories: { id: string; label: string; color: string }[];
}

export default function GraphistryKnowledgeGraph({ paperId }: { paperId: number }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  useEffect(() => {
    async function loadGraph() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/papers/${paperId}/knowledge-graph`);
        if (!res.ok) throw new Error('Failed to load knowledge graph');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error loading graph');
      } finally {
        setLoading(false);
      }
    }
    if (paperId) loadGraph();
  }, [paperId]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 850;
    const height = 540;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Gradient background
    const defs = svg.append('defs');
    const bgGrad = defs.append('linearGradient').attr('id', 'graph-bg').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#070512');
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#120d24');

    svg.insert('rect', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#graph-bg)')
      .attr('rx', 16);

    const container = svg.append('g').attr('class', 'graph-container');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Filter nodes and links
    const filteredNodes = data.nodes.filter((n) => {
      const matchCat = !activeCategory || n.category === activeCategory;
      const matchSearch = !searchFilter || n.name.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCat && matchSearch;
    });

    const activeNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = data.links.filter((l) => {
      const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      return activeNodeIds.has(sId) && activeNodeIds.has(tId);
    });

    // Clone data for D3 mutation safety
    const nodesCopy: GraphNode[] = filteredNodes.map((d) => ({ ...d }));
    const linksCopy: GraphLink[] = filteredLinks.map((d) => ({ ...d }));

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodesCopy)
      .force('link', d3.forceLink<GraphNode, GraphLink>(linksCopy).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 12));

    simulationRef.current = simulation;

    // Arrow markers
    defs.append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 22)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1 L 10 5 L 0 9 z')
      .attr('fill', '#64748b');

    // Draw links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksCopy)
      .enter()
      .append('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', (d) => Math.max(1.2, d.weight * 1.5))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#graph-arrow)');

    // Draw link label text
    const linkLabels = container.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(linksCopy)
      .enter()
      .append('text')
      .attr('font-size', '8.5px')
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .text((d) => d.relation);

    // Draw node groups
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodesCopy)
      .enter()
      .append('g')
      .attr('class', 'node-item')
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelectedNode(d));

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag as any);

    // Node outer glow
    node.append('circle')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', (d) => d.color)
      .attr('opacity', 0.25);

    // Node core circle
    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (selectedNode?.id === d.id ? '#ffffff' : d.color))
      .attr('stroke', (d) => d.border)
      .attr('stroke-width', 2);

    // Node label text
    node.append('text')
      .attr('y', (d) => d.radius + 14)
      .attr('fill', '#e2e8f0')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('text-anchor', 'middle')
      .text((d) => d.name);

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 3);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

  }, [data, activeCategory, searchFilter, selectedNode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Extracting Entity & Knowledge Graph Topology...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-slate-900/60 border border-red-500/30 rounded-2xl text-center">
        <p className="text-sm text-red-400">Failed to render knowledge graph: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Graphistry & GNN Knowledge Graph
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                {data.total_nodes} Nodes · {data.total_edges} Relationships
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Interactive physics simulation linking architecture, methods, benchmarks & datasets
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search entities..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
          <button
            onClick={() => simulationRef.current?.alpha(0.3).restart()}
            className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Reheat Simulation Physics"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <svg ref={svgRef} className="w-full h-[540px] select-none" />

          {/* Category Filter Pills */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-xl">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition backdrop-blur-md border ${
                activeCategory === null
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition backdrop-blur-md border flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-slate-800 border-white/40 text-white'
                    : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Inspector */}
        <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl space-y-4">
          <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            Entity Inspector
          </h5>

          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                  {selectedNode.category_label}
                </span>
                <h4 className="text-sm font-extrabold text-white">{selectedNode.name}</h4>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Node Centrality Degree</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                  {selectedNode.degree} Connections
                </span>
              </div>

              <div className="pt-2">
                <span className="text-slate-400 block mb-1 font-semibold">Entity Description:</span>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed text-[11px]">
                  {selectedNode.description || 'Core research component extracted from document sections.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-12 text-center">
              Click on any node in the knowledge network to inspect its relationships and domain properties.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
