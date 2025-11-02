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
    baseUrl: process.env.NEXT_PUBLIC_BASIC_MODEL_BASE_URL || "",
    model: process.env.NEXT_PUBLIC_BASIC_MODEL_NAME || "",
    apiKey: process.env.NEXT_PUBLIC_BASIC_MODEL_API_KEY || "",
    tokenLimit: 8000,
  },
  reasoningModel: {
    baseUrl: process.env.NEXT_PUBLIC_REASONING_MODEL_BASE_URL || "",
    model: process.env.NEXT_PUBLIC_REASONING_MODEL_NAME || "",
    apiKey: process.env.NEXT_PUBLIC_REASONING_MODEL_API_KEY || "",
    tokenLimit: 8000,
  },
    // Search engine settings - loaded from conf.yaml or .env
  searchEngine: {
      engine: process.env.NEXT_PUBLIC_SEARCH_ENGINE || "tavily",
      apiKey: process.env.NEXT_PUBLIC_SEARCH_API_KEY || "",
      includeImages: process.env.NEXT_PUBLIC_SEARCH_INCLUDE_IMAGES === "true" || false,
      minScoreThreshold: parseFloat(process.env.NEXT_PUBLIC_SEARCH_MIN_SCORE_THRESHOLD || "0.4"),
      maxContentLength: 5000,
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
      tokenLimit: number;
    };
    reasoningModel: {
      baseUrl: string;
      model: string;
      apiKey: string;
      tokenLimit: number;
    };
    // Search engine settings
    searchEngine: {
      engine: string;
      apiKey: string;
      includeImages: boolean;
      minScoreThreshold: number;
      maxContentLength: number;
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
    
    // Ensure all general settings have default values
    for (const key in DEFAULT_SETTINGS.general) {
      if (!(key in settings.general)) {
        settings.general[key as keyof SettingsState["general"]] =
          DEFAULT_SETTINGS.general[key as keyof SettingsState["general"]];
      }
    }

    // Ensure nested objects have all required fields
    if (!settings.general.basicModel || typeof settings.general.basicModel !== 'object') {
      settings.general.basicModel = DEFAULT_SETTINGS.general.basicModel;
    } else {
      // Ensure basicModel has all required fields
      const basicModel = settings.general.basicModel;
      if (!('tokenLimit' in basicModel)) {
        basicModel.tokenLimit = DEFAULT_SETTINGS.general.basicModel.tokenLimit;
      }
    }

    if (!settings.general.reasoningModel || typeof settings.general.reasoningModel !== 'object') {
      settings.general.reasoningModel = DEFAULT_SETTINGS.general.reasoningModel;
    } else {
      // Ensure reasoningModel has all required fields
      const reasoningModel = settings.general.reasoningModel;
      if (!('tokenLimit' in reasoningModel)) {
        reasoningModel.tokenLimit = DEFAULT_SETTINGS.general.reasoningModel.tokenLimit;
      }
    }

    if (!settings.general.searchEngine || typeof settings.general.searchEngine !== 'object') {
      settings.general.searchEngine = DEFAULT_SETTINGS.general.searchEngine;
    } else {
      // Ensure searchEngine has all required fields
      const searchEngine = settings.general.searchEngine;
      if (!('maxContentLength' in searchEngine)) {
        searchEngine.maxContentLength = DEFAULT_SETTINGS.general.searchEngine.maxContentLength;
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
  
  // Extract model settings - only send if all required fields are present
  const basicModelSettings = general.basicModel && 
    general.basicModel.baseUrl && 
    general.basicModel.model && 
    general.basicModel.apiKey ? {
    baseUrl: general.basicModel.baseUrl,
    model: general.basicModel.model,
    apiKey: general.basicModel.apiKey,
    tokenLimit: general.basicModel.tokenLimit,
  } : undefined;
  
  const reasoningModelSettings = general.reasoningModel && 
    general.reasoningModel.baseUrl && 
    general.reasoningModel.model && 
    general.reasoningModel.apiKey ? {
    baseUrl: general.reasoningModel.baseUrl,
    model: general.reasoningModel.model,
    apiKey: general.reasoningModel.apiKey,
    tokenLimit: general.reasoningModel.tokenLimit,
  } : undefined;
  
  // Extract search engine settings
  const searchEngineSettings = general.searchEngine ? {
    engine: general.searchEngine.engine,
    apiKey: general.searchEngine.apiKey,
    includeImages: general.searchEngine.includeImages,
    minScoreThreshold: general.searchEngine.minScoreThreshold,
    maxContentLength: general.searchEngine.maxContentLength,
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
