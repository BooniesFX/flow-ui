// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { create } from "zustand";

import type { MCPServerMetadata, SimpleMCPServerMetadata } from "../mcp";

const SETTINGS_KEY = "deerflow.settings";

const DEFAULT_SETTINGS: SettingsState = {
  general: {
    autoAcceptedPlan: false,
    enableClarification: false,
    maxClarificationRounds: 3,
    enableDeepThinking: false,
    enableBackgroundInvestigation: false,
    maxPlanIterations: 1,
    maxStepNum: 3,
    maxSearchResults: 3,
    reportStyle: "academic",
    // Model settings - loaded from conf.yaml or .env
    basicModel: {
      baseUrl: process.env.NEXT_PUBLIC_BASIC_MODEL_BASE_URL || "https://api-inference.modelscope.cn/v1",
      model: process.env.NEXT_PUBLIC_BASIC_MODEL_NAME || "ZhipuAI/GLM-4.6",
      apiKey: process.env.NEXT_PUBLIC_BASIC_MODEL_API_KEY || "",
    },
    reasoningModel: {
      baseUrl: process.env.NEXT_PUBLIC_REASONING_MODEL_BASE_URL || "https://api-inference.modelscope.cn/v1",
      model: process.env.NEXT_PUBLIC_REASONING_MODEL_NAME || "Qwen/Qwen3-235B-A22B-Thinking-2507",
      apiKey: process.env.NEXT_PUBLIC_REASONING_MODEL_API_KEY || "",
    },
    // Search engine settings - loaded from conf.yaml or .env
    searchEngine: {
      engine: process.env.NEXT_PUBLIC_SEARCH_ENGINE || "tavily",
      apiKey: process.env.NEXT_PUBLIC_SEARCH_API_KEY || "",
      includeImages: process.env.NEXT_PUBLIC_SEARCH_INCLUDE_IMAGES === "true" || false,
      minScoreThreshold: parseFloat(process.env.NEXT_PUBLIC_SEARCH_MIN_SCORE_THRESHOLD || "0.4"),
    },
  },
  mcp: {
    servers: [],
  },
};

export type SettingsState = {
  general: {
    autoAcceptedPlan: boolean;
    enableClarification: boolean;
    maxClarificationRounds: number;
    enableDeepThinking: boolean;
    enableBackgroundInvestigation: boolean;
    maxPlanIterations: number;
    maxStepNum: number;
    maxSearchResults: number;
    reportStyle: "academic" | "popular_science" | "news" | "social_media" | "strategic_investment";
    // Model settings
    basicModel: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
    reasoningModel: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
    // Search engine settings
    searchEngine: {
      engine: string;
      apiKey: string;
      includeImages: boolean;
      minScoreThreshold: number;
    };
  };
  mcp: {
    servers: MCPServerMetadata[];
  };
};

export const useSettingsStore = create<SettingsState>(() => ({
  ...DEFAULT_SETTINGS,
}));

export const useSettings = (key: keyof SettingsState) => {
  return useSettingsStore((state) => state[key]);
};

export const changeSettings = (settings: SettingsState) => {
  useSettingsStore.setState(settings);
};

export const loadSettings = () => {
  if (typeof window === "undefined") {
    return;
  }
  const json = localStorage.getItem(SETTINGS_KEY);
  if (json) {
    const settings = JSON.parse(json);
    for (const key in DEFAULT_SETTINGS.general) {
      if (!(key in settings.general)) {
        settings.general[key as keyof SettingsState["general"]] =
          DEFAULT_SETTINGS.general[key as keyof SettingsState["general"]];
      }
    }

    try {
      useSettingsStore.setState(settings);
    } catch (error) {
      console.error(error);
    }
  }
};

export const saveSettings = () => {
  const latestSettings = useSettingsStore.getState();
  const json = JSON.stringify(latestSettings);
  localStorage.setItem(SETTINGS_KEY, json);
};

export const getChatStreamSettings = () => {
  let mcpSettings:
    | {
        servers: Record<
          string,
          MCPServerMetadata & {
            enabled_tools: string[];
            add_to_agents: string[];
          }
        >;
      }
    | undefined = undefined;
  const { mcp, general } = useSettingsStore.getState();
  const mcpServers = mcp.servers.filter((server) => server.enabled);
  if (mcpServers.length > 0) {
    mcpSettings = {
      servers: mcpServers.reduce((acc, cur) => {
        const { transport, env, headers } = cur;
        let server: SimpleMCPServerMetadata;
        if (transport === "stdio") {
          server = {
            name: cur.name,
            transport,
            env,
            command: cur.command,
            args: cur.args,
          };
        } else {
          server = {
            name: cur.name,
            transport,
            headers,
            url: cur.url,
          };
        }
        return {
          ...acc,
          [cur.name]: {
            ...server,
            enabled_tools: cur.tools.map((tool) => tool.name),
            add_to_agents: ["researcher"],
          },
        };
      }, {}),
    };
  }
  
  // Extract model settings
  const basicModelSettings = general.basicModel ? {
    baseUrl: general.basicModel.baseUrl,
    model: general.basicModel.model,
    apiKey: general.basicModel.apiKey,
  } : undefined;
  
  const reasoningModelSettings = general.reasoningModel ? {
    baseUrl: general.reasoningModel.baseUrl,
    model: general.reasoningModel.model,
    apiKey: general.reasoningModel.apiKey,
  } : undefined;
  
  // Extract search engine settings
  const searchEngineSettings = general.searchEngine ? {
    engine: general.searchEngine.engine,
    apiKey: general.searchEngine.apiKey,
    includeImages: general.searchEngine.includeImages,
    minScoreThreshold: general.searchEngine.minScoreThreshold,
  } : undefined;
  
  return {
    ...general,
    mcpSettings,
    basicModel: basicModelSettings,
    reasoningModel: reasoningModelSettings,
    searchEngine: searchEngineSettings,
  };
};

export function setReportStyle(
  value: "academic" | "popular_science" | "news" | "social_media" | "strategic_investment",
) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      reportStyle: value,
    },
  }));
  saveSettings();
}

export function setEnableDeepThinking(value: boolean) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      enableDeepThinking: value,
    },
  }));
  saveSettings();
}

export function setEnableBackgroundInvestigation(value: boolean) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      enableBackgroundInvestigation: value,
    },
  }));
  saveSettings();
}

export function setBasicModelBaseUrl(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      basicModel: {
        ...state.general.basicModel,
        baseUrl: value,
      },
    },
  }));
  saveSettings();
}

export function setBasicModelName(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      basicModel: {
        ...state.general.basicModel,
        model: value,
      },
    },
  }));
  saveSettings();
}

export function setBasicModelApiKey(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      basicModel: {
        ...state.general.basicModel,
        apiKey: value,
      },
    },
  }));
  saveSettings();
}

export function setReasoningModelBaseUrl(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      reasoningModel: {
        ...state.general.reasoningModel,
        baseUrl: value,
      },
    },
  }));
  saveSettings();
}

export function setReasoningModelName(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      reasoningModel: {
        ...state.general.reasoningModel,
        model: value,
      },
    },
  }));
  saveSettings();
}

export function setReasoningModelApiKey(value: string) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      reasoningModel: {
        ...state.general.reasoningModel,
        apiKey: value,
      },
    },
  }));
  saveSettings();
}

export function setEnableClarification(value: boolean) {
  useSettingsStore.setState((state) => ({
    general: {
      ...state.general,
      enableClarification: value,
    },
  }));
  saveSettings();
}
loadSettings();
