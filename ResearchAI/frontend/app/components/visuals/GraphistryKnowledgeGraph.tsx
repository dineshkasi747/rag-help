'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  Share2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Search, 
  Info, 
  Cpu, 
  Network, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  Zap,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { API_URL as API_BASE_URL } from '../../config';
import MathMarkdownRenderer from '../MathMarkdownRenderer';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  category: string;
  category_label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  technical_details?: string;
  significance?: string;
  mechanisms?: string[];
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

interface NodeDeepDive {
  entity_name: string;
  category: string;
  executive_summary: string;
  mathematical_and_architectural_formulation: string;
  role_in_methodology: string;
  empirical_impact_and_results: string;
  key_takeaways: string[];
  suggested_questions: string[];
}

export default function GraphistryKnowledgeGraph({ paperId }: { paperId: number }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Deep-dive LLM state
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveData, setDeepDiveData] = useState<NodeDeepDive | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const loadGraph = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/papers/${paperId}/knowledge-graph`);
      if (!res.ok) throw new Error('Failed to load knowledge graph');
      const json = await res.json();
      
      if ((!json.nodes || json.nodes.length === 0) && retryCount < 3) {
        // Auto-retry in 2.5s while background parsing completes
        setTimeout(() => loadGraph(retryCount + 1), 2500);
        return;
      }
      
      setData(json);
      if (json.nodes && json.nodes.length > 0 && !selectedNode) {
        setSelectedNode(json.nodes[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paperId) {
      setSelectedNode(null);
      setDeepDiveData(null);
      loadGraph();
    }
  }, [paperId]);

  // When selectedNode changes, reset deep-dive
  useEffect(() => {
    setDeepDiveData(null);
    setDeepDiveLoading(false);
  }, [selectedNode?.id]);

  const handleFetchDeepDive = async () => {
    if (!selectedNode || deepDiveLoading) return;
    setDeepDiveLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/papers/${paperId}/knowledge-graph/explain-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_name: selectedNode.name,
          category: selectedNode.category,
          description: selectedNode.description,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setDeepDiveData(result);
      }
    } catch (e) {
      console.error('Failed to generate deep dive:', e);
    } finally {
      setDeepDiveLoading(false);
    }
  };

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
      .force('link', d3.forceLink<GraphNode, GraphLink>(linksCopy).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 16));

    simulationRef.current = simulation;

    // Arrow markers
    defs.append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 24)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1 L 10 5 L 0 9 z')
      .attr('fill', '#7a4aff');

    // Draw links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksCopy)
      .enter()
      .append('line')
      .attr('stroke', '#3b2d66')
      .attr('stroke-width', (d) => Math.max(1.5, d.weight * 1.8))
      .attr('stroke-opacity', 0.75)
      .attr('marker-end', 'url(#graph-arrow)');

    // Draw link label text
    const linkLabels = container.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(linksCopy)
      .enter()
      .append('text')
      .attr('font-size', '8.5px')
      .attr('fill', '#c084fc')
      .attr('font-weight', '600')
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

    // Node outer pulsing glow
    node.append('circle')
      .attr('r', (d) => d.radius + 8)
      .attr('fill', (d) => d.color)
      .attr('opacity', (d) => (selectedNode?.id === d.id ? 0.45 : 0.2));

    // Node core circle
    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (selectedNode?.id === d.id ? '#ffffff' : d.color))
      .attr('stroke', (d) => (selectedNode?.id === d.id ? '#a855f7' : d.border))
      .attr('stroke-width', (d) => (selectedNode?.id === d.id ? 3.5 : 2));

    // Node label text
    node.append('text')
      .attr('y', (d) => d.radius + 15)
      .attr('fill', '#f1f5f9')
      .attr('font-size', '10.5px')
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
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 4);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

  }, [data, activeCategory, searchFilter, selectedNode]);

  // Find connected links for the selected node
  const connectedLinks = data && selectedNode
    ? data.links.filter((l) => {
        const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
        return sId === selectedNode.id || tId === selectedNode.id;
      })
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-950/80 border border-slate-800 rounded-3xl backdrop-blur-xl space-y-4">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-bold text-white">Synthesizing Interactive Knowledge Graph...</p>
          <p className="text-xs text-slate-400 mt-1">Extracting architectural blocks, algorithmic methods, benchmarks &amp; semantic links</p>
        </div>
      </div>
    );
  }

  if (error || !data || data.total_nodes === 0 || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="p-10 bg-slate-950/80 border border-slate-800 rounded-3xl text-center space-y-4 backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-400 flex items-center justify-center mx-auto shadow-lg">
          <Network className="w-7 h-7" />
        </div>
        <h4 className="text-base font-extrabold text-white">Knowledge Graph Topology Engine</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          {error
            ? `Connection notice: ${error}`
            : 'Knowledge graph entity relationships are currently being extracted from the document sections.'}
        </p>
        <button
          onClick={() => loadGraph()}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold transition shadow-lg cursor-pointer"
        >
          Generate Knowledge Graph
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white border border-white/20 shadow-md">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              Graphistry &amp; GNN Knowledge Network
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono font-bold">
                {data.total_nodes} Entities · {data.total_edges} Semantic Links
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Click any node for an in-depth theoretical and architectural explanation
            </p>
          </div>
        </div>

        {/* Search & Reheat Physics */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter entities..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>
          <button
            onClick={() => simulationRef.current?.alpha(0.4).restart()}
            className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-violet-500 transition cursor-pointer"
            title="Reheat Simulation Physics"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Graph Canvas Visual */}
        <div className="lg:col-span-7 relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <svg ref={svgRef} className="w-full h-[580px] select-none" />

          {/* Category Filter Pills */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-xl">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition backdrop-blur-md border ${
                activeCategory === null
                  ? 'bg-violet-600 border-violet-400 text-white shadow-lg'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Entities
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition backdrop-blur-md border flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-slate-800 border-white/50 text-white shadow-md'
                    : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Entity Inspector Sidebar */}
        <div className="lg:col-span-5 p-5 bg-slate-900/90 border border-slate-800/90 rounded-3xl backdrop-blur-2xl space-y-4 shadow-2xl flex flex-col justify-between max-h-[580px] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Comprehensive Entity Inspector
              </h5>
              {selectedNode && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                  style={{ backgroundColor: selectedNode.bg, color: selectedNode.color, border: `1px solid ${selectedNode.border}` }}
                >
                  {selectedNode.category_label}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4 pt-3 text-xs">
                {/* Node Title & Centrality */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-violet-400">Selected Graph Node</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold">
                      {selectedNode.degree} Connections
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">{selectedNode.name}</h4>
                </div>

                {/* In-Depth Multi-Sentence Explanation */}
                <div className="space-y-1.5">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                    Detailed Explanation:
                  </span>
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 text-slate-200 leading-relaxed text-[11.5px] font-normal shadow-sm">
                    <MathMarkdownRenderer content={selectedNode.description} className="text-[11.5px]" />
                  </div>
                </div>

                {/* Technical / Mathematical Mechanics */}
                {selectedNode.technical_details && (
                  <div className="space-y-1.5">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      Technical &amp; Mathematical Mechanics:
                    </span>
                    <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-200 leading-relaxed text-[11px]">
                      <MathMarkdownRenderer content={selectedNode.technical_details} className="text-[11px]" />
                    </div>
                  </div>
                )}

                {/* Key Mechanisms Pills */}
                {selectedNode.mechanisms && selectedNode.mechanisms.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 font-bold text-[11px]">Key Mechanisms &amp; Features:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.mechanisms.map((mech, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[10.5px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {mech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Relationships in Graph */}
                {connectedLinks.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 font-bold text-[11px]">Connected Relationships ({connectedLinks.length}):</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {connectedLinks.map((cl, idx) => {
                        const sName = typeof cl.source === 'object' ? (cl.source as GraphNode).name : cl.source;
                        const tName = typeof cl.target === 'object' ? (cl.target as GraphNode).name : cl.target;
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px]">
                            <span className="text-slate-300 font-semibold truncate max-w-[120px]">{sName}</span>
                            <span className="px-2 py-0.5 rounded bg-violet-600/20 border border-violet-500/30 text-violet-300 text-[9.5px] font-bold">
                              {cl.relation}
                            </span>
                            <span className="text-slate-300 font-semibold truncate max-w-[120px]">{tName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Live Deep Dive Report Section */}
                {deepDiveData && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/40 to-slate-950 border border-violet-500/30 space-y-3 mt-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-violet-300 font-bold">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <span>Academic Deep-Dive Report</span>
                    </div>

                    <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                      <div>
                        <strong className="text-white block mb-0.5">Role in Methodology:</strong>
                        <MathMarkdownRenderer content={deepDiveData.role_in_methodology} className="text-[11px]" />
                      </div>
                      {deepDiveData.mathematical_and_architectural_formulation && (
                        <div>
                          <strong className="text-white block mb-0.5">Mathematical &amp; Architectural Formulation:</strong>
                          <MathMarkdownRenderer content={deepDiveData.mathematical_and_architectural_formulation} className="text-[11px]" />
                        </div>
                      )}
                      <div>
                        <strong className="text-white block mb-0.5">Empirical Impact:</strong>
                        <MathMarkdownRenderer content={deepDiveData.empirical_impact_and_results} className="text-[11px]" />
                      </div>
                    </div>

                    {deepDiveData.key_takeaways && deepDiveData.key_takeaways.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-violet-400">Core Takeaways:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                          {deepDiveData.key_takeaways.map((tk, i) => (
                            <li key={i}>{tk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center space-y-2">
                <Network className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs text-slate-400">Click any node in the knowledge network above to inspect its deep theoretical explanation.</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {selectedNode && (
            <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
              <button
                onClick={handleFetchDeepDive}
                disabled={deepDiveLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deepDiveLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Synthesizing Academic Analysis...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{deepDiveData ? 'Re-generate Deep-Dive' : 'Generate Full AI Deep-Dive'}</span>
                  </>
                )}
              </button>

              <Link
                href={`/chat?query=${encodeURIComponent(`Explain the role, mathematical mechanics, and significance of ${selectedNode.name} in this research paper.`)}`}
                className="w-full py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                <span>Ask About &quot;{selectedNode.name}&quot; in Chatbot</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
