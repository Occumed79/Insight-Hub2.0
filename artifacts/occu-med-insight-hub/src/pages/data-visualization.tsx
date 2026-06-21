import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceStatusBadge } from "@/components/insight/IntelligenceStatusBadge";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";
import type { ChartDefinition, MetricDefinition, SignalDefinition, RiskMatrixPoint, OpportunityMatrixPoint, DossierSectionDefinition } from "@/company-configs/types";

interface ProfileVisualizationModel {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  metrics: any[];
  charts: ChartDefinition[];
  signals: SignalDefinition[];
  dossierSections: DossierSectionDefinition[];
  sourceRecords: any[];
  riskMatrix: RiskMatrixPoint[];
  opportunityMatrix: OpportunityMatrixPoint[];
}

function buildProfileVisualizationModel({
  company,
  config,
  profile,
  metrics,
  sources
}: {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  config: any;
  profile: any;
  metrics: any[];
  sources: any[];
}): ProfileVisualizationModel {
  const configMetrics = (config.metricDefinitions ?? []).map((metric: any) => ({ ...metric, companyId: config.companyId }));
  const mergedMetrics = [...metrics, ...configMetrics.filter((metric: any) => !metrics.some((existing) => existing.id === metric.id))] as any[];
  
  return {
    company,
    metrics: mergedMetrics,
    charts: config.chartDefinitions ?? [],
    signals: config.executiveSignals ?? [],
    dossierSections: config.dossierSections ?? [],
    sourceRecords: sources,
    riskMatrix: config.riskMatrix ?? [],
    opportunityMatrix: config.opportunityMatrix ?? []
  };
}

interface VisualizationDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selection: any;
}

function VisualizationDetailDrawer({ isOpen, onClose, selection }: VisualizationDetailDrawerProps) {
  if (!selection) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-0 right-0 z-50 w-full max-w-md border-t border-cyan-100/20 bg-[#030813]/95 p-6 backdrop-blur-xl lg:bottom-0 lg:right-8 lg:top-auto lg:rounded-t-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Detail View</h3>
            <button onClick={onClose} className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-100/10">
              Close
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Label</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.label || selection.name || 'N/A'}</p>
            </div>
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Value</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.value !== undefined ? selection.value.toLocaleString() : 'N/A'}</p>
            </div>
            {selection.unit && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Unit</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.unit}</p>
              </div>
            )}
            {selection.category && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Category</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.category}</p>
              </div>
            )}
            {selection.note && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Note</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.note}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface VisualizationFilterBarProps {
  filters: {
    showMetrics: boolean;
    showSignals: boolean;
    showCharts: boolean;
    showSources: boolean;
    showDossier: boolean;
    showRisk: boolean;
    showOpportunity: boolean;
  };
  onFilterChange: (key: string, value: boolean) => void;
}

function VisualizationFilterBar({ filters, onFilterChange }: VisualizationFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(filters).map(([key, value]) => (
        <button
          key={key}
          onClick={() => onFilterChange(key, !value)}
          className={`rounded-lg border px-3 py-1.5 text-xs transition ${
            value
              ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
              : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
          }`}
        >
          {key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}
        </button>
      ))}
    </div>
  );
}

interface VisualizationCanvasProps {
  activeMethod: string;
  vizModel: ProfileVisualizationModel;
  filteredData: any[];
  activeSelection: any;
  setActiveSelection: (selection: any) => void;
  setDetailDrawerOpen: (open: boolean) => void;
  semanticZoomLevel: 'overview' | 'detail';
  isExpanded: boolean;
  filters: {
    showMetrics: boolean;
    showSignals: boolean;
    showCharts: boolean;
    showSources: boolean;
    showDossier: boolean;
    showRisk: boolean;
    showOpportunity: boolean;
  };
}

function VisualizationCanvas({ activeMethod, vizModel, filteredData, activeSelection, setActiveSelection, setDetailDrawerOpen, semanticZoomLevel, isExpanded, filters }: VisualizationCanvasProps) {
  const dataToRender = activeMethod === 'interactive-filter' ? filteredData :
    activeMethod === 'semantic-zoom' && semanticZoomLevel === 'overview' ? 
      [...vizModel.metrics.slice(0, 8), ...vizModel.signals.slice(0, 4)] :
      activeMethod === 'semantic-zoom' && semanticZoomLevel === 'detail' ?
        [...vizModel.metrics, ...vizModel.signals] :
      vizModel.metrics;

  const getNodePosition = (index: number, total: number, method: string) => {
    const centerX = 50;
    const centerY = 50;
    const radius = 35;
    
    switch (method) {
      case 'vector-displacement':
      case 'chromatic-aberration':
      case 'procedural-grid':
      case 'concentric-ripple':
      case 'negative-space':
      case 'vector-lattice':
      case 'radiant-gradient':
        const angle = (index / total) * 2 * Math.PI;
        return {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      case 'geometric-anchor':
      case 'algorithmic-edge':
      case 'synchronous-path':
      case 'vector-node':
      case 'holographic-depth':
      case 'kinetic-vector':
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: 10 + (col * 80 / cols),
          y: 10 + (row * 80 / cols)
        };
      default:
        const defaultAngle = (index / total) * 2 * Math.PI;
        return {
          x: centerX + radius * Math.cos(defaultAngle),
          y: centerY + radius * Math.sin(defaultAngle)
        };
    }
  };

  const renderCanvas = () => {
    if (dataToRender.length === 0) {
      return <p className="flex h-full items-center justify-center text-sm text-cyan-100/40">No data available for current filter/zoom level</p>;
    }

    const displayData = dataToRender.slice(0, isExpanded ? 30 : 15);
    const canvasHeight = isExpanded ? 700 : 500;

    switch (activeMethod) {
      case 'vector-displacement':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <radialGradient id="lensGradient" cx="50%" cy="50%" r="30%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.1)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
              </defs>
              <circle cx="50%" cy="50%" r="30%" fill="url(#lensGradient)" />
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'chromatic-aberration':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    {isSelected && (
                      <>
                        <circle
                          cx={`${pos.x + 0.5}%`}
                          cy={`${pos.y}%`}
                          r={8}
                          fill="rgba(239,68,68,0.4)"
                          className="pointer-events-none"
                        />
                        <circle
                          cx={`${pos.x - 0.5}%`}
                          cy={`${pos.y}%`}
                          r={8}
                          fill="rgba(6,182,212,0.4)"
                          className="pointer-events-none"
                        />
                      </>
                    )}
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'geometric-anchor':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    {isSelected && (
                      <>
                        <line x1={`${pos.x}%`} y1="0%" x2={`${pos.x}%`} y2="100%" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
                        <line x1="0%" y1={`${pos.y}%`} x2="100%" y2={`${pos.y}%`} stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
                        <line x1={`${pos.x - 10}%`} y1={`${pos.y - 10}%`} x2={`${pos.x + 10}%`} y2={`${pos.y + 10}%`} stroke="rgba(16,185,129,0.5)" strokeWidth="1" />
                        <line x1={`${pos.x + 10}%`} y1={`${pos.y - 10}%`} x2={`${pos.x - 10}%`} y2={`${pos.y + 10}%`} stroke="rgba(16,185,129,0.5)" strokeWidth="1" />
                      </>
                    )}
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.4)'}
                      stroke="rgba(16,185,129,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'procedural-grid':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <pattern id="gridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPattern)" />
              {activeSelection && (
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  fill="none"
                  stroke="rgba(34,211,238,0.3)"
                  strokeWidth="1"
                >
                  <animate attributeName="r" values="30%;45%;30%" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'algorithmic-edge':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    {isSelected && (
                      <rect
                        x={`${pos.x - 12}%`}
                        y={`${pos.y - 12}%`}
                        width="24%"
                        height="24%"
                        fill="none"
                        stroke="rgba(34,211,238,0.8)"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      >
                        <animate attributeName="strokeDashoffset" from="0" to="12" dur="1s" repeatCount="indefinite" />
                      </rect>
                    )}
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'concentric-ripple':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {activeSelection && displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                if (isSelected) {
                  return (
                    <g key={`ripple-${index}`}>
                      {[1, 2, 3].map((i) => (
                        <circle
                          key={i}
                          cx={`${pos.x}%`}
                          cy={`${pos.y}%`}
                          r={8 + i * 6}
                          fill="none"
                          stroke="rgba(34,211,238,0.4 - i * 0.1)"
                          strokeWidth="1"
                        >
                          <animate attributeName="r" values={`${8 + i * 6};${20 + i * 6};${8 + i * 6}`} dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.5;0;0.5" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
                        </circle>
                      ))}
                    </g>
                  );
                }
                return null;
              })}
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'negative-space':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                const isDimmed = activeSelection && !isSelected;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(0,0,0,0.9)' : isDimmed ? 'rgba(34,211,238,0.2)' : 'rgba(34,211,238,0.4)'}
                      stroke={isSelected ? 'rgba(34,211,238,1)' : 'rgba(34,211,238,0.8)'}
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill={isSelected ? 'rgba(34,211,238,1)' : isDimmed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)'}
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'vector-lattice':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    {displayData.slice(0, index).map((otherItem, otherIndex) => {
                      const otherPos = getNodePosition(otherIndex, displayData.length, activeMethod);
                      const distance = Math.sqrt(Math.pow(pos.x - otherPos.x, 2) + Math.pow(pos.y - otherPos.y, 2));
                      if (distance < 20) {
                        return (
                          <line
                            key={`line-${index}-${otherIndex}`}
                            x1={`${pos.x}%`}
                            y1={`${pos.y}%`}
                            x2={`${otherPos.x}%`}
                            y2={`${otherPos.y}%`}
                            stroke="rgba(168,85,247,0.2)"
                            strokeWidth="0.5"
                          />
                        );
                      }
                      return null;
                    })}
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(168,85,247,0.8)' : 'rgba(168,85,247,0.4)'}
                      stroke="rgba(168,85,247,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'synchronous-path':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <line
                      x1={`${pos.x - 15}%`}
                      y1={`${pos.y}%`}
                      x2={`${pos.x + 15}%`}
                      y2={`${pos.y}%`}
                      stroke={isSelected ? 'rgba(251,191,36,0.8)' : 'rgba(251,191,36,0.3)'}
                      strokeWidth={isSelected ? 2 : 1}
                    >
                      {isSelected && (
                        <animate attributeName="stroke-dasharray" values="0,30;30,0" dur="1.5s" repeatCount="indefinite" />
                      )}
                    </line>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(251,191,36,0.8)' : 'rgba(251,191,36,0.4)'}
                      stroke="rgba(251,191,36,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'vector-node':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    {isSelected && (
                      <>
                        <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={12} fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
                        <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={16} fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="1" />
                      </>
                    )}
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'radiant-gradient':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.3)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
              </defs>
              {activeSelection && <rect width="100%" height="100%" fill="url(#glowGradient)" />}
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                const isDimmed = activeSelection && !isSelected;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : isDimmed ? 'rgba(34,211,238,0.2)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill={isDimmed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)'}
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'holographic-depth':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                const depth = index % 3;
                const opacity = 0.3 + depth * 0.2;
                const scale = 0.8 + depth * 0.1;
                return (
                  <g key={item.id || index} style={{ opacity }}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={(isSelected ? 8 : 5) * scale}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : `rgba(34,211,238,${opacity})`}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize={8 * scale}
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'kinetic-vector':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(20,184,166,0.8)' : 'rgba(20,184,166,0.4)'}
                      stroke="rgba(20,184,166,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    >
                      {isSelected && (
                        <animate attributeName="r" values="8;10;8" dur="0.5s" repeatCount="indefinite" />
                      )}
                    </circle>
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      case 'contextual-morph':
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                const isRelated = activeSelection && activeSelection.category === item.category;
                const isUnrelated = activeSelection && !isSelected && !isRelated;
                const opacity = isUnrelated ? 0.3 : 1;
                return (
                  <g key={item.id || index} style={{ opacity }}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(139,92,246,0.8)' : isRelated ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.4)'}
                      stroke="rgba(139,92,246,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );

      default:
        return (
          <div className="relative h-full" style={{ height: canvasHeight }}>
            <svg className="absolute inset-0 h-full w-full">
              {displayData.map((item, index) => {
                const pos = getNodePosition(index, displayData.length, activeMethod);
                const isSelected = activeSelection && activeSelection.id === item.id;
                return (
                  <g key={item.id || index}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r={isSelected ? 8 : 5}
                      fill={isSelected ? 'rgba(34,211,238,0.8)' : 'rgba(34,211,238,0.4)'}
                      stroke="rgba(34,211,238,0.8)"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer transition-all hover:fill-opacity-80"
                      onClick={() => { setActiveSelection(item); setDetailDrawerOpen(true); }}
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y - 8}%`}
                      fill="rgba(255,255,255,0.7)"
                      fontSize="8"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {item.label?.slice(0, 8) || 'N/A'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-100/12 bg-black/18">
      {renderCanvas()}
    </div>
  );
}

export default function DataVisualization() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const profile = dataset.profiles.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  
  const [activeMethod, setActiveMethod] = useState<string>("vector-displacement");
  const [activeSelection, setActiveSelection] = useState<any>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [semanticZoomLevel, setSemanticZoomLevel] = useState<'overview' | 'detail'>('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [filters, setFilters] = useState({
    showMetrics: true,
    showSignals: true,
    showCharts: true,
    showSources: true,
    showDossier: true,
    showRisk: true,
    showOpportunity: true
  });

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    profile,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources
  });

  const handleFilterChange = (key: string, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleNodeClick = (node: any) => {
    setActiveSelection(node);
    setDetailDrawerOpen(true);
  };

  const getFilteredData = () => {
    let data: any[] = [];
    if (filters.showMetrics) {
      data = [...data, ...vizModel.metrics.map(m => ({ ...m, type: 'metric' }))];
    }
    if (filters.showSignals) {
      data = [...data, ...vizModel.signals.map(s => ({ ...s, type: 'signal' }))];
    }
    if (filters.showCharts) {
      data = [...data, ...vizModel.charts.map(c => ({ ...c, type: 'chart' }))];
    }
    if (filters.showSources) {
      data = [...data, ...vizModel.sourceRecords.map(s => ({ ...s, type: 'source' }))];
    }
    if (filters.showDossier) {
      data = [...data, ...vizModel.dossierSections.map(d => ({ ...d, type: 'dossier' }))];
    }
    if (filters.showRisk) {
      data = [...data, ...vizModel.riskMatrix.map(r => ({ ...r, type: 'risk' }))];
    }
    if (filters.showOpportunity) {
      data = [...data, ...vizModel.opportunityMatrix.map(o => ({ ...o, type: 'opportunity' }))];
    }
    return data;
  };

  const filteredData = getFilteredData();

  const visualizationMethods = [
    {
      id: "vector-displacement",
      title: "Vector Displacement Mapping",
      description: "Pointer-based lens refraction effect on data cards",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.15)]"
    },
    {
      id: "chromatic-aberration",
      title: "Chromatic Aberration Highlighting",
      description: "RGB split / technical glitch halo on active data",
      effectClass: "hover:shadow-[0_0_40px_rgba(239,68,68,.15),0_0_40px_rgba(6,182,212,.15)]"
    },
    {
      id: "geometric-anchor",
      title: "Geometric Anchor Snapping",
      description: "Precise crosshair-like emphasis on metric values",
      effectClass: "hover:shadow-[0_0_40px_rgba(16,185,129,.15)]"
    },
    {
      id: "subtractive-masking",
      title: "Subtractive Masking Overlays",
      description: "Value labels cut into glass surface",
      effectClass: "hover:shadow-[inset_0_0_40px_rgba(34,211,238,.1)]"
    },
    {
      id: "procedural-grid",
      title: "Procedural Grid Resonances",
      description: "Radial pulse effect around active metrics",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.2),0_0_80px_rgba(34,211,238,.1)]"
    },
    {
      id: "algorithmic-edge",
      title: "Algorithmic Edge-Tracing",
      description: "Hard-edge animated outline on selected elements",
      effectClass: "hover:shadow-[0_0_2px_rgba(34,211,238,.8),0_0_8px_rgba(34,211,238,.4)]"
    },
    {
      id: "concentric-ripple",
      title: "Concentric Ripple Metrics",
      description: "Faint ring feedback on clicked metrics",
      effectClass: "hover:shadow-[0_0_0_4px_rgba(34,211,238,.3),0_0_0_8px_rgba(34,211,238,.15)]"
    },
    {
      id: "negative-space",
      title: "Negative Space Inversion",
      description: "Dark void with neon edge for important metrics",
      effectClass: "hover:shadow-[inset_0_0_40px_rgba(0,0,0,.8),0_0_20px_rgba(34,211,238,.3)]"
    },
    {
      id: "vector-lattice",
      title: "Vector Lattice Distortion",
      description: "Pointer movement warps background grid",
      effectClass: "hover:shadow-[0_0_40px_rgba(168,85,247,.15)]"
    },
    {
      id: "color-shift",
      title: "Color-Shift Isometry",
      description: "Smooth luminous gradient state transitions",
      effectClass: "hover:shadow-[0_0_40px_rgba(236,72,153,.15)]"
    },
    {
      id: "synchronous-path",
      title: "Synchronous Path Illumination",
      description: "Light sweep along selected paths/bars",
      effectClass: "hover:shadow-[0_0_40px_rgba(251,191,36,.15)]"
    },
    {
      id: "vector-node",
      title: "Vector Node Expansion",
      description: "Datapoint blooms into precise vector node",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.25)]"
    },
    {
      id: "radiant-gradient",
      title: "Radiant Gradient Focus",
      description: "Active data glows, supporting data recedes",
      effectClass: "hover:shadow-[0_0_60px_rgba(34,211,238,.2),0_0_100px_rgba(34,211,238,.1)]"
    },
    {
      id: "isometric-slice",
      title: "Isometric Slice-View",
      description: "Selected card lifts with isometric plane effect",
      effectClass: "hover:shadow-[8px_8px_0_rgba(34,211,238,.2)]"
    },
    {
      id: "semantic-zoom",
      title: "Generative Semantic Zoom",
      description: "Toggle between abstract overview and detail mode",
      effectClass: "hover:shadow-[0_0_40px_rgba(99,102,241,.15)]"
    },
    {
      id: "holographic-depth",
      title: "Holographic Depth Layers",
      description: "Layered translucent panels with parallax",
      effectClass: "hover:shadow-[0_0_40px_rgba(34,211,238,.15),0_0_80px_rgba(34,211,238,.05)]"
    },
    {
      id: "kinetic-vector",
      title: "Kinetic Vector Transitions",
      description: "Clean vector-like motion animations",
      effectClass: "hover:shadow-[0_0_40px_rgba(20,184,166,.15)]"
    },
    {
      id: "contextual-morph",
      title: "Contextual Data Morphing",
      description: "Selected metric emphasizes related values",
      effectClass: "hover:shadow-[0_0_40px_rgba(139,92,246,.15)]"
    },
    {
      id: "interactive-filter",
      title: "Interactive Filtering",
      description: "Method-level filter controls on data",
      effectClass: "hover:shadow-[0_0_40px_rgba(234,88,12,.15)]"
    },
    {
      id: "zoom-pan",
      title: "Zoom and Pan",
      description: "Focused/expanded mode for dense charts",
      effectClass: "hover:shadow-[0_0_40px_rgba(14,165,233,.15)]"
    },
    {
      id: "linked-visualizations",
      title: "Linked Visualizations / Brushing",
      description: "Shared selection highlights across cards",
      effectClass: "hover:shadow-[0_0_40px_rgba(22,163,74,.15)]"
    },
    {
      id: "click-reveal",
      title: "Click-to-Reveal",
      description: "Persistent detail drawer on value click",
      effectClass: "hover:shadow-[0_0_40px_rgba(244,63,94,.15)]"
    }
  ];

  const getMethodDataCount = (methodId: string) => {
    switch (methodId) {
      case "vector-displacement":
      case "chromatic-aberration":
      case "geometric-anchor":
      case "subtractive-masking":
      case "procedural-grid":
      case "algorithmic-edge":
      case "concentric-ripple":
      case "negative-space":
      case "vector-lattice":
      case "color-shift":
      case "synchronous-path":
      case "vector-node":
      case "radiant-gradient":
      case "isometric-slice":
      case "holographic-depth":
      case "kinetic-vector":
      case "contextual-morph":
        return vizModel.metrics.length;
      case "semantic-zoom":
        return vizModel.metrics.length + vizModel.signals.length;
      case "interactive-filter":
      case "zoom-pan":
      case "linked-visualizations":
        return filteredData.length;
      case "click-reveal":
        return activeSelection ? 1 : 0;
      default:
        return 0;
    }
  };

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 02"
          title="Data Visualization"
          subtitle="Advanced visualization lab for profile-level intelligence, using the same source data as Data Profiles."
          actions={<IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />}
          status={<IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />}
        />
        <DataQualityBanner warnings={status.dataQualityWarnings} />

        {/* Profile Summary Strip */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-100/12 bg-black/18 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Metrics:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.metrics.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Charts:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.charts.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Signals:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.signals.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Sources:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.sourceRecords.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Dossier:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.dossierSections.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Risk:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.riskMatrix.length > 0 ? "✓" : "—"}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Opp:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.opportunityMatrix.length > 0 ? "✓" : "—"}</span>
          </div>
        </div>

        {/* Method Rail */}
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Visualization method</p>
          <div className="flex flex-wrap gap-2">
            {visualizationMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setActiveMethod(method.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  activeMethod === method.id
                    ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
                    : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
                }`}
              >
                {method.title}
              </button>
            ))}
          </div>
        </div>

        {/* Active Method Canvas */}
        {activeMethod && (
          <div className="mb-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/35">Active method canvas</p>
                <h3 className="mt-1 text-xl font-bold text-white">
                  {visualizationMethods.find(m => m.id === activeMethod)?.title}
                </h3>
              </div>
              <div className="flex gap-2">
                {activeMethod === 'zoom-pan' && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10"
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                )}
                {activeMethod === 'semantic-zoom' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSemanticZoomLevel('overview')}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        semanticZoomLevel === 'overview'
                          ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
                          : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setSemanticZoomLevel('detail')}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        semanticZoomLevel === 'detail'
                          ? 'border-cyan-100/30 bg-cyan-100/10 text-cyan-50'
                          : 'border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20'
                      }`}
                    >
                      Detail
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {activeMethod === 'interactive-filter' && (
              <div className="mb-4">
                <VisualizationFilterBar filters={filters} onFilterChange={handleFilterChange} />
              </div>
            )}

            <VisualizationCanvas
              activeMethod={activeMethod}
              vizModel={vizModel}
              filteredData={filteredData}
              activeSelection={activeSelection}
              setActiveSelection={setActiveSelection}
              setDetailDrawerOpen={setDetailDrawerOpen}
              semanticZoomLevel={semanticZoomLevel}
              isExpanded={isExpanded}
              filters={filters}
            />
          </div>
        )}

        {/* Click-to-Reveal Detail Drawer */}
        <VisualizationDetailDrawer
          isOpen={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          selection={activeSelection}
        />
      </section>
    </main>
  );
}
