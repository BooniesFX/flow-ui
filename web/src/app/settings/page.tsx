// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from 'sonner';
import { SiteHeader } from "~/app/chat/components/site-header";

interface SettingsConfig {
  general: {
    language: string;
    theme: string;
    autoAcceptPlan: boolean;
    enableClarification: boolean;
    maxClarificationRounds: number;
    maxPlanIterations: number;
    maxStepsOfPlan: number;
    maxSearchResults: number;
  };
  mcp: {
    servers: any[];
  };
  reportStyle: {
    writingStyle: string;
  };
}

const defaultConfig: SettingsConfig = {
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

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [config, setConfig] = useState<SettingsConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load settings from backend API
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setConfig(data.config || defaultConfig))
      .catch(err => {
        console.error('Failed to load settings:', err);
        setConfig(defaultConfig);
      });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast.success('设置已保存 Settings saved successfully');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('保存失败 Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    toast.info('设置已重置 Settings reset to default');
  };

  return (
    <>
      <SiteHeader />
      <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">{t('general.title')}</TabsTrigger>
          <TabsTrigger value="mcp">{t('mcp.title')}</TabsTrigger>
          <TabsTrigger value="reportStyle">{t('reportStyle.title')}</TabsTrigger>
          <TabsTrigger value="about">{t('about.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('general.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">语言 / Language</Label>
                <Select value={config.general.language} onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  general: { ...prev.general, language: value }
                }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">{t('theme', { defaultValue: 'Theme' })}</Label>
                <Select value={config.general.theme} onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  general: { ...prev.general, theme: value }
                }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="autoAcceptPlan">{t('general.autoAcceptPlan')}</Label>
                <Switch
                  id="autoAcceptPlan"
                  checked={config.general.autoAcceptPlan}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    general: { ...prev.general, autoAcceptPlan: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableClarification">{t('general.enableClarification')}</Label>
                <Switch
                  id="enableClarification"
                  checked={config.general.enableClarification}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    general: { ...prev.general, enableClarification: checked }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxClarificationRounds">{t('general.maxClarificationRounds')}</Label>
                <Input
                  id="maxClarificationRounds"
                  type="number"
                  min="1"
                  max="10"
                  value={config.general.maxClarificationRounds.toString()}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    general: { ...prev.general, maxClarificationRounds: parseInt(e.target.value) || 3 }
                  }))}
                />
                <p className="text-sm text-muted-foreground">{t('general.maxClarificationRoundsDescription')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxSearchResults">{t('general.maxSearchResults')}</Label>
                <Input
                  id="maxSearchResults"
                  type="number"
                  min="1"
                  max="20"
                  value={config.general.maxSearchResults.toString()}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    general: { ...prev.general, maxSearchResults: parseInt(e.target.value) || 3 }
                  }))}
                />
                <p className="text-sm text-muted-foreground">{t('general.maxSearchResultsDescription')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>{t('about.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t("settings.title")}</h3>
                  <p className="text-muted-foreground mt-2">
                    {t("settings.description")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">版本 Version</h4>
                  <p className="text-sm text-muted-foreground">1.0.0</p>
                </div>
                <div>
                  <h4 className="font-medium">许可证 License</h4>
                  <p className="text-sm text-muted-foreground">MIT License</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-8">
        <Button variant="outline" onClick={handleReset} disabled={loading}>
          {t('cancel')}
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? '保存中...' : t('save')}
        </Button>
      </div>
    </div>
    </>
  );
}