// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import type { Message } from "~/core/messages";
import type { AgentNodeProps } from "./agent-node";

export interface ResearchNode extends AgentNodeProps {
  id: string;
  timestamp: number;
  parentId?: string;
  children?: string[];
  toolCallResults?: any[];
  content?: string;
  reasoningContent?: string;
  toolCalls?: any[];
}

/**
 * Transform a Message object to a ResearchNode
 */
export function messageToNode(message: Message, index: number): ResearchNode {
  // Determine agent type and status
  const agent = message.agent || "unknown";
  const status = message.isStreaming 
    ? "running" 
    : message.error 
      ? "error" 
      : "completed";
  
  // Extract research goal from content
  let researchGoal = "";
  if (message.content) {
    // Try to extract a concise research goal from the content
    const lines = message.content.split('\n');
    // Look for a title-like line (starting with #) or take the first non-empty line
    const titleLine = lines.find(line => line.trim().startsWith('#')) || 
                     lines.find(line => line.trim().length > 0);
    researchGoal = titleLine ? titleLine.replace(/^#+\s*/, '').trim() : "";
  }
  
  // Extract tool call results if available
  const toolCallResults = message.toolCalls?.map(toolCall => ({
    name: toolCall.name,
    args: toolCall.args,
    result: toolCall.result,
    error: toolCall.result?.startsWith("Error") ? toolCall.result : undefined
  })) || [];
  
  return {
    id: message.id,
    agent,
    label: getAgentLabel(agent),
    researchGoal: researchGoal || getDefaultResearchGoal(agent),
    status,
    error: message.error,
    content: message.content,
    reasoningContent: message.reasoningContent,
    toolCalls: message.toolCalls,
    toolCallResults,
    timestamp: Date.now() - index * 1000, // Simulate timestamp based on order
  };
}

/**
 * Get human-readable label for an agent
 */
function getAgentLabel(agent: string): string {
  const labels: Record<string, string> = {
    coordinator: "Coordinator",
    planner: "Planner",
    reporter: "Reporter",
    researcher: "Researcher",
    coder: "Coder",
    "human-feedback": "Human Feedback",
    "research-team": "Research Team",
  };
  
  return labels[agent] || agent.charAt(0).toUpperCase() + agent.slice(1);
}

/**
 * Get default research goal for an agent
 */
function getDefaultResearchGoal(agent: string): string {
  const goals: Record<string, string> = {
    coordinator: "Understanding user requirements",
    planner: "Creating research plan",
    reporter: "Generating final report",
    researcher: "Gathering information",
    coder: "Executing code analysis",
    "human-feedback": "Awaiting user input",
    "research-team": "Coordinating research tasks",
  };
  
  return goals[agent] || "Processing research task";
}

/**
 * Transform an array of Messages to ResearchNodes with parent-child relationships
 */
export function messagesToNodes(messages: Message[]): ResearchNode[] {
  if (!messages.length) return [];
  
  // Convert messages to nodes
  const nodes: ResearchNode[] = messages.map((message, index) => 
    messageToNode(message, index)
  );
  
  // Establish parent-child relationships based on message flow
  // For now, we'll create a simple linear relationship
  nodes.forEach((node, index) => {
    if (index > 0) {
      node.parentId = nodes[index - 1]?.id;
    }
    if (index < nodes.length - 1) {
      node.children = [nodes[index + 1]?.id!].filter(Boolean);
    }
  });
  
  return nodes;
}

/**
 * Find the root node (typically the coordinator)
 */
export function findRootNode(nodes: ResearchNode[]): ResearchNode | undefined {
  return nodes.find(node => !node.parentId);
}

/**
 * Find child nodes of a given node
 */
export function findChildNodes(nodes: ResearchNode[], parentId: string): ResearchNode[] {
  return nodes.filter(node => node.parentId === parentId);
}

/**
 * Find sibling nodes of a given node
 */
export function findSiblingNodes(nodes: ResearchNode[], nodeId: string): ResearchNode[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node?.parentId) return [];
  
  return nodes.filter(n => n.parentId === node.parentId && n.id !== nodeId);
}