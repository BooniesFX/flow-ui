// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { zodResolver } from "@hookform/resolvers/zod";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import type { SettingsState } from "~/core/store";

import type { Tab } from "./types";

const generalFormSchema = z.object({
  autoAcceptedPlan: z.boolean(),
  enableClarification: z.boolean(),
  maxClarificationRounds: z.number().min(1, {
    message: "Max clarification rounds must be at least 1.",
  }),
  maxPlanIterations: z.number().min(1, {
    message: "Max plan iterations must be at least 1.",
  }),
  maxStepNum: z.number().min(1, {
    message: "Max step number must be at least 1.",
  }),
  maxSearchResults: z.number().min(1, {
    message: "Max search results must be at least 1.",
  }),
  // Others
  enableBackgroundInvestigation: z.boolean(),
  enableDeepThinking: z.boolean(),
  reportStyle: z.enum(["academic", "popular_science", "news", "social_media","strategic_investment"]),
  // Model settings
  basicModel: z.object({
    baseUrl: z.string().url().min(1, "Base URL is required"),
    model: z.string().min(1, "Model name is required"),
    apiKey: z.string(),
  }),
  reasoningModel: z.object({
    baseUrl: z.string().url().min(1, "Base URL is required"),
    model: z.string().min(1, "Model name is required"),
    apiKey: z.string(),
  }),
  // Search engine settings
  searchEngine: z.object({
    engine: z.string().min(1, "Search engine is required"),
    apiKey: z.string(),
    includeImages: z.boolean(),
    minScoreThreshold: z.number().min(0).max(1, "Min score threshold must be between 0 and 1"),
  }),
});

export const GeneralTab: Tab = ({
  settings,
  onChange,
}: {
  settings: SettingsState;
  onChange: (changes: Partial<SettingsState>) => void;
}) => {
  const t = useTranslations("settings.general");
  const generalSettings = useMemo(() => settings.general, [settings]);
  const form = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema, undefined, undefined),
    defaultValues: generalSettings,
    mode: "all",
    reValidateMode: "onBlur",
  });

  const currentSettings = form.watch();
  useEffect(() => {
    let hasChanges = false;
    for (const key in currentSettings) {
      if (
        currentSettings[key as keyof typeof currentSettings] !==
        settings.general[key as keyof SettingsState["general"]]
      ) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) {
      onChange({ general: currentSettings });
    }
  }, [currentSettings, onChange, settings]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">{t("title")}</h1>
      </header>
      <main>
        <Form {...form}>
          <form className="space-y-8">
            <FormField
              control={form.control}
              name="autoAcceptedPlan"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="autoAcceptedPlan"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Label className="text-sm" htmlFor="autoAcceptedPlan">
                        {t("autoAcceptPlan")}
                      </Label>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="enableClarification"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="enableClarification"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Label className="text-sm" htmlFor="enableClarification">
                        {t("enableClarification")} {field.value ? "(On)" : "(Off)"}
                      </Label>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            {form.watch("enableClarification") && (
              <FormField
                control={form.control}
                name="maxClarificationRounds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("maxClarificationRounds")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-60"
                        type="number"
                        defaultValue={field.value}
                        min={1}
                        onChange={(event) =>
                          field.onChange(parseInt(event.target.value || "1"))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t("maxClarificationRoundsDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="maxPlanIterations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maxPlanIterations")}</FormLabel>
                  <FormControl>
                    <Input
                      className="w-60"
                      type="number"
                      defaultValue={field.value}
                      min={1}
                      onChange={(event) =>
                        field.onChange(parseInt(event.target.value || "0"))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t("maxPlanIterationsDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxStepNum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maxStepsOfPlan")}</FormLabel>
                  <FormControl>
                    <Input
                      className="w-60"
                      type="number"
                      defaultValue={field.value}
                      min={1}
                      onChange={(event) =>
                        field.onChange(parseInt(event.target.value || "0"))
                      }
                    />
                  </FormControl>
                  <FormDescription>{t("maxStepsDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxSearchResults"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("maxSearchResults")}</FormLabel>
                  <FormControl>
                    <Input
                      className="w-60"
                      type="number"
                      defaultValue={field.value}
                      min={1}
                      onChange={(event) =>
                        field.onChange(parseInt(event.target.value || "0"))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t("maxSearchResultsDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Basic Model Settings */}
            <div className="rounded-lg border p-4">
              <h2 className="text-md font-medium mb-4">{t("basicModel.title")}</h2>
              <FormField
                control={form.control}
                name="basicModel.baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basicModel.baseUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        placeholder="https://api.openai.com/v1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basicModel.model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basicModel.model")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        placeholder="gpt-4"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basicModel.apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("basicModel.apiKey")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        type="password"
                        placeholder="sk-..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("basicModel.apiKeyDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Reasoning Model Settings */}
            <div className="rounded-lg border p-4">
              <h2 className="text-md font-medium mb-4">{t("reasoningModel.title")}</h2>
              <FormField
                control={form.control}
                name="reasoningModel.baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reasoningModel.baseUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        placeholder="https://api.openai.com/v1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reasoningModel.model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reasoningModel.model")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        placeholder="gpt-4"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reasoningModel.apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reasoningModel.apiKey")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        type="password"
                        placeholder="sk-..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("reasoningModel.apiKeyDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Search Engine Settings */}
            <div className="rounded-lg border p-4">
              <h2 className="text-md font-medium mb-4">{t("searchEngine.title")}</h2>
              <FormField
                control={form.control}
                name="searchEngine.engine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("searchEngine.engine")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("searchEngine.selectEngine")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tavily">Tavily</SelectItem>
                        <SelectItem value="duckduckgo">DuckDuckGo</SelectItem>
                        <SelectItem value="brave">Brave Search</SelectItem>
                        <SelectItem value="arxiv">ArXiv</SelectItem>
                        <SelectItem value="searx">SearX</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="searchEngine.apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("searchEngine.apiKey")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        type="password"
                        placeholder="tvly-..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("searchEngine.apiKeyDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="searchEngine.includeImages"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>{t("searchEngine.includeImages")}</FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="searchEngine.minScoreThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("searchEngine.minScoreThreshold")}</FormLabel>
                    <FormControl>
                      <Input
                        className="w-full"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("searchEngine.minScoreThresholdDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
};
GeneralTab.displayName = "General";
GeneralTab.icon = Settings;
