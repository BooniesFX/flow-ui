// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Download, HeadphonesIcon, Play, Pause, List } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
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

          <Separator className="mb-6" />

          {/* Main content */}
          <div className="prose prose-gray max-w-none">
            <Markdown>{report.content}</Markdown>
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
      </div>
    </div>
  );
}