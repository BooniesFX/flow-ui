// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { env } from "~/env";

import type { MCPServerMetadata } from "../mcp";
import type { Resource } from "../messages";
import { extractReplayIdFromSearchParams } from "../replay/get-replay-id";
import { fetchStream } from "../sse";
import { sleep } from "../utils";

import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent } from "./types";

export async function* chatStream(
  userMessage: string,
  params: {
    thread_id: string;
    resources?: Array<Resource>;
    auto_accepted_plan: boolean;
    enable_clarification?: boolean;
    max_clarification_rounds?: number;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
    enable_deep_thinking?: boolean;
    enable_background_investigation: boolean;
    report_style?: "academic" | "popular_science" | "news" | "social_media" | "strategic_investment";
    mcp_settings?: {
      servers: Record<
        string,
        MCPServerMetadata & {
          enabled_tools: string[];
          add_to_agents: string[];
        }
      >;
    };
    // Model settings
    basic_model?: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
    reasoning_model?: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
    // Search engine settings
    search_engine?: {
      engine: string;
      apiKey: string;
      includeImages: boolean;
      minScoreThreshold: number;
    };
  },
  options: { abortSignal?: AbortSignal } = {},
) {
  if (
    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ||
    location.search.includes("mock") ||
    location.search.includes("replay=")
  ) 
    return yield* chatReplayStream(userMessage, params, options);
  
  try{
    const stream = fetchStream(resolveServiceURL("chat/stream"), {
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        ...params,
      }),
      signal: options.abortSignal,
    });
    
    for await (const event of stream) {
      yield {
        type: event.event,
        data: JSON.parse(event.data),
      } as ChatEvent;
    }
  }catch(e){
    console.error(e);
  }
}

async function* chatReplayStream(
  userMessage: string,
  params: {
    thread_id: string;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
  } = {
    thread_id: "__mock__",
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 1,
    max_search_results: 3,
    interrupt_feedback: undefined,
  },
  options: { abortSignal?: AbortSignal } = {},
): AsyncIterable<ChatEvent> {
  const urlParams = new URLSearchParams(window.location.search);
  let replayFilePath = "";
  if (urlParams.has("mock")) {
    if (urlParams.get("mock")) {
      replayFilePath = `/mock/${urlParams.get("mock")!}.txt`;
    } else {
      if (params.interrupt_feedback === "accepted") {
        replayFilePath = "/mock/final-answer.txt";
      } else if (params.interrupt_feedback === "edit_plan") {
        replayFilePath = "/mock/re-plan.txt";
      } else {
        replayFilePath = "/mock/first-plan.txt";
      }
    }
    fastForwardReplaying = true;
  } else {
    const replayId = extractReplayIdFromSearchParams(window.location.search);
    if (replayId && isValidReplayId(replayId)) {
      // For replay mode, only use files from /replay directory, not the report API
      replayFilePath = `/replay/${replayId}.txt`;
    } else {
      // Fallback to a default replay - use a working mock file
      replayFilePath = "/mock/first-plan.txt";
    }
  }
  
  const text = await fetchReplay(replayFilePath, {
    abortSignal: options.abortSignal,
  });
  
  // Handle stream format (existing logic for mock files)
  const normalizedText = text.replace(/\r\n/g, "\n");
  const chunks = normalizedText.split("\n\n");
  for (const chunk of chunks) {
    // Skip empty chunks
    if (!chunk.trim()) continue;
    
    const lines = chunk.split("\n");
    let event = "";
    let data = "";
    
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        event = line.substring(7);
      } else if (line.startsWith("data: ")) {
        data = line.substring(6);
      }
    }

    // Skip chunks without event or data
    if (!event || !data) continue;

    try {
      const chatEvent = {
        type: event,
        data: JSON.parse(data),
      } as ChatEvent;
      if (chatEvent.type === "message_chunk") {
        if (!chatEvent.data.finish_reason) {
          await sleepInReplay(50);
        }
      } else if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(500);
      }
      yield chatEvent;
      if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(800);
      } else if (chatEvent.type === "message_chunk") {
        if (chatEvent.data.role === "user") {
          await sleepInReplay(500);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}

const replayCache = new Map<string, string>();

// List of valid replay IDs from /public/replay directory with their titles
const REPLAY_DATA = {
  "ai-twin-insurance": "Would you insure your AI twin?",
  "china-food-delivery": "How do you view the takeaway war in China?",
  "eiffel-tower-vs-tallest-building": "How tall is Eiffel Tower compared to tallest building?",
  "github-top-trending-repo": "What are the top trending repositories on GitHub?",
  "nanjing-traditional-dishes": "Write an article about Nanjing's traditional dishes",
  "rag": "RAG demonstration",
  "rental-apartment-decoration": "How to decorate a small rental apartment?",
  "review-of-the-professional": "Introduce the movie 'Léon: The Professional'",
  "ultra-processed-foods": "Are ultra-processed foods linked to health?"
};

function isValidReplayId(replayId: string): boolean {
  return replayId in REPLAY_DATA;
}

function getReplayTitle(replayId: string): string {
  return REPLAY_DATA[replayId as keyof typeof REPLAY_DATA] || "Unknown Replay";
}

export async function fetchReplay(
  url: string,
  options: { abortSignal?: AbortSignal } = {},
) {
  if (replayCache.has(url)) {
    return replayCache.get(url)!;
  }
  const res = await fetch(url, {
    signal: options.abortSignal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay: ${res.statusText}`);
  }
  const text = await res.text();
  replayCache.set(url, text);
  return text;
}

export async function fetchReplayTitle() {
  const replayId = extractReplayIdFromSearchParams(window.location.search);
  
  if (replayId && isValidReplayId(replayId)) {
    // Use the predefined title from the mapping table
    return getReplayTitle(replayId);
  }
  
  // If no replayId or error occurred, throw to trigger error handling
  throw new Error('No replay ID found');
}

export async function sleepInReplay(ms: number) {
  if (fastForwardReplaying) {
    await sleep(0);
  } else {
    await sleep(ms);
  }
}

let fastForwardReplaying = false;
export function fastForwardReplay(value: boolean) {
  fastForwardReplaying = value;
}
