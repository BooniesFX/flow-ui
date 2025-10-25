// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, Play, Pause, SkipForward, SkipBack } from "lucide-react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";

import { useSelectedNodeId, useStore } from "~/core/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/deer-flow/tooltip";

import { AgentNode } from "./agent-node";
import { NodeDetail } from "./node-detail";
import { messagesToNodes } from "./data-transform";
import "@xyflow/react/dist/style.css";

export interface ResearchVisualizationProps {
  researchId: string;
  className?: string;
}

export function ResearchVisualization({
  researchId,
  className,
}: ResearchVisualizationProps) {
  // Fullscreen and playback state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<any>(null);

  // Get activity IDs for this research
  const activityIds = useStore(
    useShallow((state) => (researchId ? state.researchActivityIds.get(researchId) || [] : []))
  );
  
  // Get all messages for these activities
  const messages = useStore(
    useShallow((state) => {
      return activityIds
        .map((id) => state.messages.get(id))
        .filter((msg): msg is NonNullable<typeof msg> => msg !== undefined);
    })
  );
  
  // Get selected node ID and setter first
  const selectedNodeId = useSelectedNodeId();
  const setSelectedNodeId = useStore(useShallow((state) => state.setSelectedNodeId));

  // Transform messages to nodes and edges
  const { nodes: flowNodes, edges } = useMemo(() => {
    const nodes = messagesToNodes(messages);
    
    // Convert to ReactFlow nodes
    const reactFlowNodes = nodes.map((node, index) => ({
      id: node.id,
      type: 'agent',
      position: { 
        x: (index % 4) * 250 + 50, // Grid layout
        y: Math.floor(index / 4) * 150 + 50 
      },
      data: {
        id: node.id,
        agent: node.agent,
        label: node.label,
        researchGoal: node.researchGoal,
        status: node.status,
        error: node.error,
        active: node.id === selectedNodeId
      }
    }));

    // Create edges based on parent-child relationships
    const flowEdges: Edge[] = [];
    nodes.forEach((node: any) => {
      if (node.parentId) {
        flowEdges.push({
          id: `${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep',
          animated: node.status === 'running',
          style: { 
            stroke: node.status === 'error' ? '#ef4444' : 
                    node.status === 'running' ? '#3b82f6' : '#10b981',
            strokeWidth: 2 
          }
        });
      }
    });

    return { nodes: reactFlowNodes, edges: flowEdges };
  }, [messages, selectedNodeId]);
  
  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
  }, [selectedNodeId, setSelectedNodeId]);
  
  // Handle close detail panel
  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);
  
  // Handle retry (placeholder for now)
  const handleRetry = useCallback((nodeId: string) => {
    console.log("Retry requested for node:", nodeId);
    // TODO: Implement retry functionality
  }, []);
  
  // Get selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = messagesToNodes(messages).find(n => n.id === selectedNodeId);
    return node || null;
  }, [messages, selectedNodeId]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (error) {
        console.error("Failed to enter fullscreen:", error);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (error) {
        console.error("Failed to exit fullscreen:", error);
      }
    }
  }, [isFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleStepForward = useCallback(() => {
    if (currentStep < flowNodes.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, flowNodes.length]);

  const handleStepBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Auto-play effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isPlaying && currentStep < flowNodes.length - 1) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= flowNodes.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000); // 2 seconds per step
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentStep, flowNodes.length]);

  // Handle ESC key for fullscreen exit
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
      if (event.key === ' ' && isFullscreen) { // Space for play/pause
        handlePlayPause();
      }
      if (event.key === 'ArrowRight' && isFullscreen) {
        handleStepForward();
      }
      if (event.key === 'ArrowLeft' && isFullscreen) {
        handleStepBack();
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen, handlePlayPause, handleStepForward, handleStepBack]);
  
  if (isFullscreen) {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Fullscreen header */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Research Flow Visualization</h2>
          <div className="flex items-center gap-2">
            {/* Playback controls */}
            <div className="flex items-center bg-muted/50 rounded-lg px-3 py-2">
              <Tooltip title="Previous step">
                <Button variant="ghost" size="icon" onClick={handleStepBack} disabled={currentStep === 0}>
                  <SkipBack className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip title={isPlaying ? "Pause" : "Play"}>
                <Button variant="ghost" size="icon" onClick={handlePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </Tooltip>
              <Tooltip title="Next step">
                <Button variant="ghost" size="icon" onClick={handleStepForward} disabled={currentStep >= flowNodes.length - 1}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </Tooltip>
              <span className="mx-3 text-sm font-medium">
                Step {currentStep + 1} / {flowNodes.length}
              </span>
            </div>
            
            <Tooltip title="Exit fullscreen (ESC)">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
        
        {/* Fullscreen visualization content */}
        <div className="flex-1 flex">
          {/* Main visualization area */}
          <div className={cn(
            "flex-grow transition-all duration-300",
            selectedNode ? "w-2/3" : "w-full"
          )}>
            <div className="h-full flex flex-col">
              {/* Visualization header */}
              <div className="px-6 py-3 border-b">
                <h3 className="text-lg font-medium">Agent Flow</h3>
              </div>
              
              {/* ReactFlow visualization */}
              <div className="flex-grow overflow-hidden">
                <ReactFlow
                  ref={flowRef}
                  nodes={flowNodes.map((node, index) => ({
                    ...node,
                    data: {
                      ...node.data,
                      active: index <= currentStep
                    }
                  }))}
                  edges={edges.map((edge, index) => ({
                    ...edge,
                    animated: index <= currentStep && isPlaying
                  }))}
                  nodeTypes={{
                    agent: FlowAgentNode
                  }}
                  fitView
                  proOptions={{ hideAttribution: true }}
                  colorMode="dark"
                  panOnScroll={false}
                  zoomOnScroll={true}
                  preventScrolling={false}
                  panOnDrag={true}
                  style={{
                    ["--xy-background-color-default" as string]: "transparent",
                  }}
                  onInit={(instance) => {
                    flowRef.current = instance;
                  }}
                  onNodeClick={(event, node) => {
                    handleNodeClick(node.id);
                  }}
                >
                  <Background
                    className="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
                    bgColor="var(--background)"
                  />
                </ReactFlow>
              </div>
            </div>
          </div>
          
          {/* Detail panel */}
          {selectedNode && (
            <div className="h-full w-1/3 border-l flex-shrink-0 max-w-2xl">
              <NodeDetail
                nodeId={selectedNode.id}
                agent={selectedNode.agent}
                researchGoal={selectedNode.researchGoal}
                content={selectedNode.content}
                toolCalls={selectedNode.toolCalls}
                error={selectedNode.error}
                reasoningContent={selectedNode.reasoningContent}
                onClose={handleCloseDetail}
                onRetry={handleRetry}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("flex h-full w-full", className)}>
      {/* Normal mode header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-lg font-medium">Research Visualization</h3>
        <Tooltip title="Enter fullscreen (F11)">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
      
      {/* Main visualization area - now full ReactFlow */}
      <div className="flex-grow w-full">
        <div className="h-full flex flex-col">
          {/* Visualization header */}
          <div className="px-4 py-2 border-b">
            <h3 className="text-lg font-medium">Agent Flow</h3>
          </div>
          
          {/* ReactFlow visualization */}
          <div className="flex-grow overflow-hidden">
            <ReactFlow
              ref={flowRef}
              nodes={flowNodes.map((node, index) => ({
                ...node,
                data: {
                  ...node.data,
                  active: index <= currentStep
                }
              }))}
              edges={edges.map((edge, index) => ({
                ...edge,
                animated: index <= currentStep && isPlaying
              }))}
              nodeTypes={{
                agent: FlowAgentNode
              }}
              fitView
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
              panOnScroll={false}
              zoomOnScroll={true}
              preventScrolling={false}
              panOnDrag={true}
              style={{
                ["--xy-background-color-default" as string]: "transparent",
              }}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
              onNodeClick={(event, node) => {
                handleNodeClick(node.id);
              }}
            >
              <Background
                className="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
                bgColor="var(--background)"
              />
            </ReactFlow>
          </div>
        </div>
      </div>
      
      {/* Detail panel */}
      {selectedNode && (
        <div className="h-full w-1/3 border-l flex-shrink-0">
          <NodeDetail
            nodeId={selectedNode.id}
            agent={selectedNode.agent}
            researchGoal={selectedNode.researchGoal}
            content={selectedNode.content}
            toolCalls={selectedNode.toolCalls}
            error={selectedNode.error}
            reasoningContent={selectedNode.reasoningContent}
            onClose={handleCloseDetail}
            onRetry={handleRetry}
          />
        </div>
      )}
    </div>
  );
}

// ReactFlow Agent Node Component
function FlowAgentNode({ data, selected }: { 
  data: {
    id: string;
    agent: string;
    label?: string;
    researchGoal?: string;
    status?: string;
    error?: string;
    active: boolean;
  };
  selected?: boolean;
}) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3"
      />
      <div 
        className={cn(
          "px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[200px] text-center transition-all duration-200",
          data.active || selected
            ? "border-primary bg-primary/10 shadow-lg scale-105" 
            : "border-border bg-background hover:border-primary/50 hover:shadow-md"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            data.status === "running" ? "bg-blue-500" :
            data.status === "completed" ? "bg-green-500" :
            data.status === "error" ? "bg-red-500" : "bg-gray-500"
          )} />
          <span className="font-medium text-sm">{data.label || data.agent}</span>
        </div>
        {data.researchGoal && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {data.researchGoal}
          </div>
        )}
        {data.error && (
          <div className="text-xs text-red-500 mt-1">
            Error: {data.error}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3"
      />
    </>
  );
}