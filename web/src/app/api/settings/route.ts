import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import yaml from 'yaml';

// Path to the conf.yaml file
const configPath = path.join(process.cwd(), '..', 'conf.yaml');

// Default configuration structure
const defaultConfigStructure = {
  general: {
    language: 'zh',
    theme: 'light',
    autoAcceptPlan: false,
    enableClarification: true,
    maxClarificationRounds: 3,
    maxPlanIterations: 2,
    maxStepsOfPlan: 3,
    maxSearchResults: 3,
  },
  mcp: {
    servers: []
  },
  reportStyle: {
    writingStyle: 'popularScience'
  }
};

// Map UI config to YAML config
function mapUIToYAML(uiConfig: Record<string, any>) {
  return {
    BASIC_MODEL: {
      base_url: uiConfig.general.basicModel?.baseUrl,
      model: uiConfig.general.basicModel?.model,
      api_key: uiConfig.general.basicModel?.apiKey,
    },
    REASONING_MODEL: {
      base_url: uiConfig.general.reasoningModel?.baseUrl,
      model: uiConfig.general.reasoningModel?.model,
      api_key: uiConfig.general.reasoningModel?.apiKey,
    },
    SEARCH_ENGINE: {
      engine: uiConfig.general.searchEngine?.engine,
      include_images: uiConfig.general.searchEngine?.includeImages,
      min_score_threshold: uiConfig.general.searchEngine?.minScoreThreshold,
    },
    GENERAL_SETTINGS: {
      language: uiConfig.general.language,
      theme: uiConfig.general.theme,
      autoAcceptPlan: uiConfig.general.autoAcceptPlan,
      enableClarification: uiConfig.general.enableClarification,
      maxClarificationRounds: uiConfig.general.maxClarificationRounds,
      maxPlanIterations: uiConfig.general.maxPlanIterations,
      maxStepsOfPlan: uiConfig.general.maxStepsOfPlan,
      maxSearchResults: uiConfig.general.maxSearchResults,
    }
  };
}

// Map YAML config to UI config
function mapYAMLToUI(yamlConfig: Record<string, any>) {
  return {
    general: {
      language: yamlConfig.GENERAL_SETTINGS?.language ?? 'zh',
      theme: yamlConfig.GENERAL_SETTINGS?.theme ?? 'light',
      autoAcceptPlan: yamlConfig.GENERAL_SETTINGS?.autoAcceptPlan ?? false,
      enableClarification: yamlConfig.GENERAL_SETTINGS?.enableClarification ?? true,
      maxClarificationRounds: yamlConfig.GENERAL_SETTINGS?.maxClarificationRounds ?? 3,
      maxPlanIterations: yamlConfig.GENERAL_SETTINGS?.maxPlanIterations ?? 2,
      maxStepsOfPlan: yamlConfig.GENERAL_SETTINGS?.maxStepsOfPlan ?? 3,
      maxSearchResults: yamlConfig.GENERAL_SETTINGS?.maxSearchResults ?? 3,
      // Model settings
      basicModel: {
        baseUrl: yamlConfig.BASIC_MODEL?.base_url ?? process.env.NEXT_PUBLIC_BASIC_MODEL_BASE_URL ?? "https://api-inference.modelscope.cn/v1",
        model: yamlConfig.BASIC_MODEL?.model ?? process.env.NEXT_PUBLIC_BASIC_MODEL_NAME ?? "ZhipuAI/GLM-4.6",
        apiKey: yamlConfig.BASIC_MODEL?.api_key ?? process.env.NEXT_PUBLIC_BASIC_MODEL_API_KEY ?? "",
      },
      reasoningModel: {
        baseUrl: yamlConfig.REASONING_MODEL?.base_url ?? process.env.NEXT_PUBLIC_REASONING_MODEL_BASE_URL ?? "https://api-inference.modelscope.cn/v1",
        model: yamlConfig.REASONING_MODEL?.model ?? process.env.NEXT_PUBLIC_REASONING_MODEL_NAME ?? "Qwen/Qwen3-235B-A22B-Thinking-2507",
        apiKey: yamlConfig.REASONING_MODEL?.api_key ?? process.env.NEXT_PUBLIC_REASONING_MODEL_API_KEY ?? "",
      },
      // Search engine settings
      searchEngine: {
        engine: yamlConfig.SEARCH_ENGINE?.engine ?? process.env.NEXT_PUBLIC_SEARCH_ENGINE ?? "tavily",
        apiKey: yamlConfig.SEARCH_ENGINE?.api_key ?? process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? "",
        includeImages: yamlConfig.SEARCH_ENGINE?.include_images === true || process.env.NEXT_PUBLIC_SEARCH_INCLUDE_IMAGES === "true" || false,
        minScoreThreshold: yamlConfig.SEARCH_ENGINE?.min_score_threshold ?? parseFloat(process.env.NEXT_PUBLIC_SEARCH_MIN_SCORE_THRESHOLD ?? "0.4"),
      },
    },
    mcp: {
      servers: []
    },
    reportStyle: {
      writingStyle: 'popularScience'
    }
  };
}

export async function GET() {
  try {
    // Read the conf.yaml file
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const yamlConfig = yaml.parse(fileContents);
      const uiConfig = mapYAMLToUI(yamlConfig);
      return NextResponse.json(uiConfig);
    } else {
      // Return default config if file doesn't exist
      return NextResponse.json(defaultConfigStructure);
    }
  } catch (error) {
    console.error('Error reading configuration:', error);
    return NextResponse.json(defaultConfigStructure);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate and merge configuration
    const updatedConfig = {
      ...defaultConfigStructure,
      ...body,
      general: {
        ...defaultConfigStructure.general,
        ...(body.general || {})
      },
      mcp: {
        ...defaultConfigStructure.mcp,
        ...(body.mcp || {})
      },
      reportStyle: {
        ...defaultConfigStructure.reportStyle,
        ...(body.reportStyle || {})
      }
    };

    // Map UI config to YAML format
    const yamlConfig = mapUIToYAML(updatedConfig);
    
    // Convert to YAML string
    const yamlString = yaml.stringify(yamlConfig);
    
    // Write to conf.yaml file
    fs.writeFileSync(configPath, yamlString, 'utf8');
    
    return NextResponse.json({ 
      success: true, 
      config: updatedConfig 
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}