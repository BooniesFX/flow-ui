// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ReportView } from "./report-view";

interface ReportPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const t = await getTranslations("report");
  const { id } = await params;
  
  try {
    // Fetch report data from backend API
    const response = await fetch(`http://localhost:8000/api/reporters/${id}`, {
      cache: "no-store",
    });
    
    if (!response.ok) {
      notFound();
    }
    
    const report = await response.json();
    
    return <ReportView report={report} />;
  } catch (error) {
    console.error("Error fetching report:", error);
    notFound();
  }
}

export async function generateMetadata({ params }: ReportPageProps) {
  const t = await getTranslations("report");
  const { id } = await params;
  
  try {
    const response = await fetch(`http://localhost:8000/api/reporters/${id}`, {
      cache: "no-store",
    });
    
    if (!response.ok) {
      return {
        title: t("title"),
        description: t("description"),
      };
    }
    
    const report = await response.json();
    
    return {
      title: report.title || t("title"),
      description: report.description || t("description"),
    };
  } catch (error) {
    return {
      title: t("title"),
      description: t("description"),
    };
  }
}