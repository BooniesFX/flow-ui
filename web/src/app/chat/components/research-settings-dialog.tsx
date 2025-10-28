// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tooltip } from "~/components/deer-flow/tooltip";
import { useSettingsStore } from "~/core/store/settings-store";

export function ResearchSettingsDialog() {
  const t = useTranslations("settings");
  const tGeneral = useTranslations("settings.general");
  const tChat = useTranslations("chat.research");
  
  // Get current settings from store
  const currentSettings = useSettingsStore();
  
  const handleSave = () => {
    // In a real implementation, we would save the settings here
    // For now, we'll just log them
    console.log("Settings saved:", currentSettings);
  };

  return (
    <Dialog>
      <Tooltip title={tChat("settings")}>
        <DialogTrigger asChild>
          <Button
            className="text-gray-400"
            size="sm"
            variant="ghost"
          >
            <Settings />
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{tGeneral("title")}</DialogTitle>
          <DialogDescription>
            {tGeneral("title")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Model Settings */}
          <div className="rounded-lg border p-4">
            <h2 className="text-md font-medium mb-4">{tGeneral("basicModel.title")}</h2>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">{tGeneral("basicModel.baseUrl")}</label>
                <div className="mt-1 p-2 border rounded-md bg-muted text-sm">
                  {currentSettings.general?.basicModel?.baseUrl || "Not configured"}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{tGeneral("basicModel.model")}</label>
                <div className="mt-1 p-2 border rounded-md bg-muted text-sm">
                  {currentSettings.general?.basicModel?.model || "Not configured"}
                </div>
              </div>
            </div>
          </div>
          
          {/* Reasoning Model Settings */}
          <div className="rounded-lg border p-4">
            <h2 className="text-md font-medium mb-4">{tGeneral("reasoningModel.title")}</h2>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">{tGeneral("reasoningModel.baseUrl")}</label>
                <div className="mt-1 p-2 border rounded-md bg-muted text-sm">
                  {currentSettings.general?.reasoningModel?.baseUrl || "Not configured"}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{tGeneral("reasoningModel.model")}</label>
                <div className="mt-1 p-2 border rounded-md bg-muted text-sm">
                  {currentSettings.general?.reasoningModel?.model || "Not configured"}
                </div>
              </div>
            </div>
          </div>
          
          {/* Search Engine Settings */}
          <div className="rounded-lg border p-4">
            <h2 className="text-md font-medium mb-4">{tGeneral("searchEngine.title")}</h2>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">{tGeneral("searchEngine.engine")}</label>
                <p className="text-sm text-muted-foreground">{currentSettings.general.searchEngine.engine}</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}