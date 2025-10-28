// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";

import { BentoCard } from "~/components/magicui/bento-grid";
import { SectionHeader } from "./section-header";

interface Reporter {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export function LatestReportersSection() {
  const t = useTranslations("landing.latestReporters");
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest reporters from API
    const fetchReporters = async () => {
      try {
        // Use backend API instead of frontend API route
        const response = await fetch('/api/reporters');
        const data = await response.json();
        
        if (response.ok) {
          setReporters(data.reporters || []);
        } else {
          console.error('Failed to fetch reporters:', data);
          // Fallback to empty array if API fails
          setReporters([]);
        }
      } catch (error) {
        console.error('Error fetching reporters:', error);
        // Fallback to empty array on network error
        setReporters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReporters();
  }, []);

  if (loading) {
    return (
      <section className="relative container flex flex-col items-center justify-center">
        <SectionHeader
          anchor="latest-reporters"
          title={t("title")}
          description={t("description")}
        />
        <div className="grid w-3/4 grid-cols-1 gap-2 sm:w-full sm:grid-cols-2 lg:grid-cols-3">
          {/* Show loading skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-full p-2">
              <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="relative container flex flex-col items-center justify-center">
      <SectionHeader
        anchor="latest-reporters"
        title={t("title")}
        description={t("description")}
      />
      {reporters.length === 0 ? (
        <div className="w-3/4 text-center text-muted-foreground py-12">
          <p>{t("noReporters", "暂无历史报告 No previous reports found")}</p>
          <p className="text-sm mt-2">
            {t("startResearch", "开始新的研究以生成报告 Start a new research to generate reports")}
          </p>
        </div>
      ) : (
        <div className="grid w-3/4 grid-cols-1 gap-2 sm:w-full sm:grid-cols-2 lg:grid-cols-3">
          {reporters.map((reporter) => (
            <div key={reporter.id} className="w-full p-2">
              <BentoCard
                {...{
                  Icon: Bot,
                  name: reporter.title,
                  description: reporter.description,
                  href: `/chat?replay=${reporter.id}`,
                  cta: t("clickToView"),
                  className: "w-full h-full",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}