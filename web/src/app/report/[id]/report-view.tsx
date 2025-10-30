// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Download, HeadphonesIcon, FileText, Play, Pause } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Markdown } from "~/components/deer-flow/markdown";
import { useRouter } from "next/navigation";

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

interface ReportViewProps {
  report: Report;
}

export function ReportView({ report }: ReportViewProps) {
  const t = useTranslations("report");
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);

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
      // Call API to generate podcast
      const response = await fetch("http://localhost:8000/api/podcast/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: report.content,
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio
        const audio = new Audio(audioUrl);
        audio.play();
        setIsPlaying(true);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error("Error generating podcast:", error);
    } finally {
      setIsGeneratingPodcast(false);
    }
  }, [report, isGeneratingPodcast]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      // Pause audio
      const audio = document.querySelector("audio") as HTMLAudioElement;
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    } else {
      // Resume or start audio
      const audio = document.querySelector("audio") as HTMLAudioElement;
      if (audio) {
        audio.play();
        setIsPlaying(true);
      } else {
        handleGeneratePodcast();
      }
    }
  }, [isPlaying, handleGeneratePodcast]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToResearch}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("backToResearch")}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{report.title}</h1>
            <p className="text-muted-foreground mt-1">{report.description}</p>
          </div>
        </div>
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
        </div>
      </div>

      {/* Report metadata */}
      <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
        <span>{t("createdAt")}: {new Date(report.createdAt).toLocaleDateString()}</span>
        {report.updatedAt !== report.createdAt && (
          <span>{t("updatedAt")}: {new Date(report.updatedAt).toLocaleDateString()}</span>
        )}
        {report.metadata?.style && (
          <Badge variant="secondary">{report.metadata.style}</Badge>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Main content */}
      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("content")}
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t("sources")}
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center gap-2">
            <HeadphonesIcon className="w-4 h-4" />
            {t("media")}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("reportContent")}</CardTitle>
              <CardDescription>{t("reportContentDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-gray max-w-none">
                <Markdown>{report.content}</Markdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("sources")}</CardTitle>
              <CardDescription>{t("sourcesDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {report.metadata?.sources && report.metadata.sources.length > 0 ? (
                <div className="space-y-4">
                  {report.metadata.sources.map((source, index) => (
                    <div key={index} className="border rounded-lg p-4">
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
              ) : (
                <p className="text-muted-foreground">{t("noSources")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="media" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("media")}</CardTitle>
              <CardDescription>{t("mediaDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {report.metadata?.images && report.metadata.images.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.metadata.images.map((image, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
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
              ) : (
                <p className="text-muted-foreground">{t("noMedia")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}