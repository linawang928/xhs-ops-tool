import { XhsOpsApp } from "@/components/xhs-ops-app";
import { getAiProviderStatus } from "@/lib/ai/status";
import type { AccountPositioningInput } from "@/lib/core/types";
import { demoProject } from "@/lib/sample-data";

type SearchParams = Record<string, string | string[] | undefined>;
const isStaticExport = process.env.GITHUB_PAGES === "true" || process.env.GITHUB_ACTIONS === "true";

function firstParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getInitialPositioningInput(params: SearchParams): AccountPositioningInput | undefined {
  const subjectArea = firstParam(params, "subjectArea")?.trim();
  const audience = firstParam(params, "audience")?.trim();
  const differentiator = firstParam(params, "differentiator")?.trim();
  const tone = firstParam(params, "tone")?.trim();

  if (!subjectArea || !audience || !differentiator || !tone) {
    return undefined;
  }

  return {
    projectId: demoProject.id,
    subjectArea,
    audience,
    differentiator,
    tone,
  };
}

function getInitialHomepageText(params: SearchParams) {
  return firstParam(params, "homepageText")?.trim() || undefined;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = !isStaticExport && searchParams ? await searchParams : {};

  return (
    <XhsOpsApp
      initialPositioningInput={getInitialPositioningInput(params)}
      initialHomepageText={getInitialHomepageText(params)}
      initialProviderStatus={getAiProviderStatus()}
    />
  );
}
