// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { motion } from "framer-motion";
import { 
  Brain, 
  FilePen, 
  MessageSquareQuote, 
  Microscope, 
  SquareTerminal, 
  UserCheck, 
  Users,
  type LucideIcon 
} from "lucide-react";
import { memo, useCallback } from "react";

import { Tooltip } from "~/components/deer-flow/tooltip";
import { ShineBorder } from "~/components/magicui/shine-border";
import { cn } from "~/lib/utils";

// Map agent names to icons
const agentIcons: Record<string, LucideIcon> = {
  coordinator: MessageSquareQuote,
  planner: Brain,
  reporter: FilePen,
  researcher: Microscope,
  coder: SquareTerminal,
  "human-feedback": UserCheck,
  "research-team": Users,
};

// Map agent names to labels
const agentLabels: Record<string, string> = {
  coordinator: "Coordinator",
  planner: "Planner",
  reporter: "Reporter",
  researcher: "Researcher",
  coder: "Coder",
  "human-feedback": "Human Feedback",
  "research-team": "Research Team",
};

export interface AgentNodeProps {
  id: string;
  agent: string;
  label?: string;
  researchGoal?: string;
  status?: "pending" | "running" | "completed" | "error";
  error?: string;
  active?: boolean;
  onClick?: (id: string) => void;
}

function AgentNodeComponent({
  id,
  agent,
  label,
  researchGoal,
  status = "pending",
  error,
  active = false,
  onClick,
}: AgentNodeProps) {
  const Icon = agentIcons[agent] || MessageSquareQuote;
  const displayLabel = label || agentLabels[agent] || agent;

  const handleClick = useCallback(() => {
    onClick?.(id);
  }, [id, onClick]);

  // Determine status color
  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "pending":
      default:
        return "bg-gray-500";
    }
  };

  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center cursor-pointer group",
        active && "z-10"
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
    >
      {/* Status indicator */}
      <div className={cn(
        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
        getStatusColor()
      )} />
      
      {/* Shine border for active node */}
      {active && (
        <ShineBorder
          shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
          className="rounded-[2px]"
        />
      )}
      
      {/* Node container */}
      <div className={cn(
        "relative flex flex-col items-center p-3 rounded-lg border shadow-sm transition-all duration-200",
        active 
          ? "bg-background border-primary shadow-lg" 
          : "bg-background/80 border-border hover:bg-background hover:shadow-md",
        "min-w-[120px]"
      )}>
        {/* Agent icon and label */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-center">
            {displayLabel}
          </span>
        </div>
        
        {/* Research goal (if provided) */}
        {researchGoal && (
          <div className="mt-2 text-xs text-muted-foreground text-center line-clamp-2">
            {researchGoal}
          </div>
        )}
        
        {/* Status badge */}
        <div className="mt-2">
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
            status === "pending" && "bg-gray-100 text-gray-800",
            status === "running" && "bg-blue-100 text-blue-800",
            status === "completed" && "bg-green-100 text-green-800",
            status === "error" && "bg-red-100 text-red-800"
          )}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
      
      {/* Error tooltip */}
      {error && (
        <Tooltip title={error}>
          <div className="absolute -bottom-1 -right-1">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">!</span>
            </div>
          </div>
        </Tooltip>
      )}
    </motion.div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const AgentNode = memo(AgentNodeComponent, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.id === nextProps.id &&
    prevProps.agent === nextProps.agent &&
    prevProps.label === nextProps.label &&
    prevProps.researchGoal === nextProps.researchGoal &&
    prevProps.status === nextProps.status &&
    prevProps.error === nextProps.error &&
    prevProps.active === nextProps.active
  );
});