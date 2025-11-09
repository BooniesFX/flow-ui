// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Download, HeadphonesIcon, Play, Pause, List, Settings, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Markdown } from "~/components/deer-flow/markdown";
import { TtsSetupDialog } from "~/components/deer-flow/tts-setup-dialog";
import { SiteHeader } from "~/app/chat/components/site-header";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "~/core/store/settings-store";

interface Report {
  id: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    style?: string;
    sources?: Array<{
      title: string;
      url: string;
      credibility: string;
    }>;
    images?: Array<{
      url: string;
      caption: string;
      alt: string;
    }>;
  };
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface ReportViewProps {
  report: Report;
}

export function ReportView({ report }: ReportViewProps) {
  const t = useTranslations("report");
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(true);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  
  // TTS Settings state
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [ttsModel, setTtsModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ttsModel');
      return saved || "FunAudioLLM/CosyVoice2-0.5B";
    }
    return "FunAudioLLM/CosyVoice2-0.5B";
  });
  const [siliconflowApiKey, setSiliconflowApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siliconflowApiKey');
      return saved || "";
    }
    return "";
  });
  const [siliconflowVoice, setSiliconflowVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siliconflowVoice');
      return saved || "";
    }
    return "";
  });
  const [siliconflowVoice2, setSiliconflowVoice2] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siliconflowVoice2');
      return saved || "";
    }
    return "";
  });
  const [siliconflowSpeed, setSiliconflowSpeed] = useState<[number, number]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siliconflowSpeed');
      return saved ? [parseFloat(saved), parseFloat(saved)] : [1.0, 1.0];
    }
    return [1.0, 1.0];
  });
  const [siliconflowGain, setSiliconflowGain] = useState<[number, number]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siliconflowGain');
      return saved ? [parseFloat(saved), parseFloat(saved)] : [0.0, 0.0];
    }
    return [0.0, 0.0];
  });

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const isoString = date.toISOString();
      if (!isoString) return dateString;
      const datePart = isoString.split('T')[0];
      if (!datePart) return dateString;
      return datePart.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1/$2/$3");
    } catch {
      return dateString;
    }
  }, []);

  // Extract table of contents from markdown content
  const extractToc = useCallback((content: string) => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;
    const counts = new Map<string, number>();
    
    while ((match = headingRegex.exec(content)) !== null) {
      if (match[1] && match[2]) {
        const level = match[1].length;
        const title = match[2].trim();
        const baseId = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        const count = counts.get(baseId) || 0;
        const uniqueId = count > 0 ? `${baseId}-${count}` : baseId;
        counts.set(baseId, count + 1);
        
        items.push({ id: uniqueId, title, level });
      }
    }
    
    setTocItems(items);
  }, []);

  // Extract TOC when content changes
  useEffect(() => {
    extractToc(report.content);
  }, [report.content, extractToc]);

  // Scroll to heading
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleBackToResearch = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const handleDownloadReport = useCallback(() => {
    const blob = new Blob([report.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  const handleGeneratePodcast = useCallback(async () => {
    if (isGeneratingPodcast) return;
    
    setIsGeneratingPodcast(true);
    try {
      // Get user's model configuration
      const settings = useSettingsStore.getState();
      const modelConfig = {
        basic_model: settings.general.basicModel,
        reasoning_model: settings.general.reasoningModel,
      };

      // Get TTS settings from localStorage
      
      // Get MiniMax settings from localStorage
      const minimaxApiKey = localStorage.getItem('minimaxApiKey') || undefined;
      const minimaxVoiceId = localStorage.getItem('minimaxVoiceId') || undefined;
      const minimaxVoiceId2 = localStorage.getItem('minimaxVoiceId2') || undefined;
      const minimaxSpeed = localStorage.getItem('minimaxSpeed') ? parseFloat(localStorage.getItem('minimaxSpeed')!) : undefined;
      const minimaxVol = localStorage.getItem('minimaxVol') ? parseFloat(localStorage.getItem('minimaxVol')!) : undefined;
      const minimaxPitch = localStorage.getItem('minimaxPitch') ? parseInt(localStorage.getItem('minimaxPitch')!) : undefined;

      // Call API to generate podcast
      const response = await fetch("http://localhost:8000/api/podcast/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: report.content,
          model: ttsModel,
          siliconflow_api_key: siliconflowApiKey || undefined,
          siliconflow_model: ttsModel,
          siliconflow_voice: siliconflowVoice || undefined,
          siliconflow_voice2: siliconflowVoice2 || undefined,
          siliconflow_speed: siliconflowSpeed[0] || undefined,
          siliconflow_gain: siliconflowGain[0] || undefined,
          minimax_api_key: minimaxApiKey,
          minimax_model: ttsModel, // Use the selected model for MiniMax
          minimax_group_id: localStorage.getItem('minimaxGroupId') || undefined, // Add group ID if available
          minimax_voice: minimaxVoiceId,
          minimax_voice2: minimaxVoiceId2,
          minimax_speed: minimaxSpeed,
          minimax_vol: minimaxVol,
          minimax_pitch: minimaxPitch,
          ...modelConfig,
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio
        const audio = new Audio(audioUrl);
        audio.play();
        setAudio(audio);
        setIsPlaying(true);
        
        audio.onended = () => {
          setIsPlaying(false);
          setAudio(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        // Clean up on unmount
        return () => {
          if (audio) {
            audio.pause();
            URL.revokeObjectURL(audioUrl);
          }
        };
      }
    } catch (error) {
      console.error("Error generating podcast:", error);
    } finally {
      setIsGeneratingPodcast(false);
    }
  }, [report, isGeneratingPodcast, ttsModel, siliconflowApiKey, siliconflowVoice, siliconflowVoice2, siliconflowSpeed, siliconflowGain]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      // Pause audio
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    } else {
      // Resume or start audio
      if (audio) {
        audio.play();
        setIsPlaying(true);
      } else {
        handleGeneratePodcast();
      }
    }
  }, [isPlaying, audio, handleGeneratePodcast]);
  
  const handleStop = useCallback(() => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setAudio(null);
      // Clean up the audio URL
      URL.revokeObjectURL(audio.src);
    }
  }, [audio]);

  return (
    <>
      <SiteHeader />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Navigation Header */}
        <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToResearch}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToResearch")}
        </Button>
      </div>

      <div className="flex gap-8">
        {/* Table of Contents Sidebar */}
        {tocItems.length > 0 && (
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <List className="w-4 h-4" />
                <h3 className="font-semibold">{t("tableOfContents") || "目录"}</h3>
              </div>
              <nav className="space-y-2">
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToHeading(item.id)}
                    className={`block text-left w-full text-sm hover:text-blue-600 transition-colors ${
                      item.level === 1 ? 'font-medium' : 
                      item.level === 2 ? 'pl-4' : 
                      item.level === 3 ? 'pl-8' : 
                      item.level === 4 ? 'pl-12' : 
                      item.level === 5 ? 'pl-16' : 'pl-20'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Report Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{report.title}</h1>
            <p className="text-muted-foreground text-lg mb-4">{report.description}</p>
            
            {/* Report metadata */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>{t("createdAt")}: {formatDate(report.createdAt)}</span>
              {report.updatedAt !== report.createdAt && (
                <span>{t("updatedAt")}: {formatDate(report.updatedAt)}</span>
              )}
              {report.metadata?.style && (
                <Badge variant="secondary">{report.metadata.style}</Badge>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t("download")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTtsSettings(true)}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {t("ttsSettings") || "TTS设置"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePlay}
                  disabled={isGeneratingPodcast}
                  className="flex items-center gap-2"
                >
                  {isGeneratingPodcast ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <HeadphonesIcon className="w-4 h-4" />
                  {isGeneratingPodcast ? t("generating") : isPlaying ? t("pause") : t("playPodcast")}
                </Button>
                {isPlaying && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStop}
                    className="flex items-center gap-2"
                  >
                    <span className="w-4 h-4 flex items-center justify-center">⏹</span>
                    {t("stop") || "Stop"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Main content */}
          <div className="prose prose-gray max-w-none">
            <Markdown>{(() => {
              const lines = report.content.split('\n');
              if (lines[0]?.startsWith('# ') && lines[0].substring(2) === report.title) {
                return lines.slice(1).join('\n');
              }
              return report.content;
            })()}</Markdown>
          </div>

      {/* Sources section */}
          {report.metadata?.sources && report.metadata.sources.length > 0 && (
            <>
              <Separator className="my-8" />
              <div>
                <h2 className="text-xl font-semibold mb-4">{t("sources")}</h2>
                <div className="grid grid-cols-1 gap-4">
                  {report.metadata.sources.map((source, index) => (
                    <div key={`source-${index}-${source.title}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{source.title}</h4>
                        <Badge variant={source.credibility === "high" ? "default" : "secondary"}>
                          {source.credibility}
                        </Badge>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm mt-2 block"
                      >
                        {source.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Media section */}
          {report.metadata?.images && report.metadata.images.length > 0 && (
            <>
              <Separator className="my-8" />
              <div>
                <h2 className="text-xl font-semibold mb-4">{t("media")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.metadata.images.map((image, index) => (
                    <div key={`image-${index}-${image.url}`} className="border rounded-lg overflow-hidden">
                      <img
                        src={image.url}
                        alt={image.alt}
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-4">
                        <p className="text-sm font-medium">{image.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          </div>
          
          <TtsSetupDialog
            open={showTtsSettings}
            onOpenChange={setShowTtsSettings}
            onSettingsSave={(settings) => {
              setTtsModel(settings.model);
              setSiliconflowApiKey(settings.siliconflowApiKey);
              setSiliconflowVoice(settings.siliconflowVoice);
              setSiliconflowVoice2(settings.siliconflowVoice2 || settings.siliconflowVoice);
              setSiliconflowSpeed([settings.siliconflowSpeed]);
              setSiliconflowGain([settings.siliconflowGain]);
              
              // Save to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('ttsModel', settings.model);
                localStorage.setItem('siliconflowApiKey', settings.siliconflowApiKey);
                localStorage.setItem('siliconflowVoice', settings.siliconflowVoice);
                localStorage.setItem('siliconflowVoice2', settings.siliconflowVoice2 || settings.siliconflowVoice);
                localStorage.setItem('siliconflowSpeed', settings.siliconflowSpeed.toString());
                localStorage.setItem('siliconflowGain', settings.siliconflowGain.toString());
                
                // Save MiniMax settings
                localStorage.setItem('minimaxApiKey', settings.minimaxApiKey || '');
                // Save MiniMax settings
                localStorage.setItem('minimaxApiKey', settings.minimaxApiKey || '');
                localStorage.setItem('minimaxVoiceId', settings.minimaxVoiceId || '');
                localStorage.setItem('minimaxVoiceId2', settings.minimaxVoiceId2 || settings.minimaxVoiceId || '');
                localStorage.setItem('minimaxSpeed', (settings.minimaxSpeed || 1.0).toString());
                localStorage.setItem('minimaxVol', (settings.minimaxVol || 1.0).toString());
                localStorage.setItem('minimaxPitch', (settings.minimaxPitch || 0).toString());
              }
            }}
            initialSettings={{
              model: ttsModel,
              siliconflowApiKey: siliconflowApiKey || "",
              siliconflowVoice: siliconflowVoice || "alex",
              siliconflowVoice2: siliconflowVoice2 || "anna",
              siliconflowSpeed: siliconflowSpeed[0] || 1.0,
              siliconflowGain: siliconflowGain[0] || 0,
              minimaxApiKey: (typeof window !== 'undefined' ? localStorage.getItem('minimaxApiKey') || '' : ''),
              minimaxVoiceId: (typeof window !== 'undefined' ? localStorage.getItem('minimaxVoiceId') || '' : ''),
              minimaxVoiceId2: (typeof window !== 'undefined' ? localStorage.getItem('minimaxVoiceId2') || '' : ''),
              minimaxSpeed: parseFloat((typeof window !== 'undefined' ? localStorage.getItem('minimaxSpeed') || '1.0' : '1.0')),
              minimaxVol: parseFloat((typeof window !== 'undefined' ? localStorage.getItem('minimaxVol') || '1.0' : '1.0')),
              minimaxPitch: parseInt((typeof window !== 'undefined' ? localStorage.getItem('minimaxPitch') || '0' : '0')),
            }}
          />
        </div>
      </div>
    </>
  );
}