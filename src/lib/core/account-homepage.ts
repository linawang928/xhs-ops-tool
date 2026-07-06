import type {
  AccountHomepageAnalysis,
  AccountHomepageInput,
  AccountPositioningInput,
  BenchmarkContentFormat,
} from "./types";

function slug(value: string) {
  return value.trim().replace(/\s+/g, "-").toLowerCase() || "profile";
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function inferSubjectArea(text: string) {
  if (includesAny(text, ["收纳", "小户型", "租房", "空间", "柜子", "整理"])) {
    return "家居收纳";
  }
  if (includesAny(text, ["护肤", "敏感肌", "成分", "屏障", "修护", "精华"])) {
    return "护肤";
  }
  if (includesAny(text, ["妆", "口红", "底妆", "黄黑皮", "通勤妆"])) {
    return "美妆";
  }
  if (includesAny(text, ["探店", "咖啡", "路线", "周末", "城市", "拍照"])) {
    return "本地生活";
  }
  return "通用成长";
}

function inferAudience(text: string, subjectArea: string) {
  if (includesAny(text, ["租房", "小户型"])) {
    return "租房党和小户型新手";
  }
  if (includesAny(text, ["敏感肌", "成分", "新手"])) {
    return "25-35 岁的成分护肤新手";
  }
  if (includesAny(text, ["通勤", "早八"])) {
    return subjectArea === "美妆" ? "通勤妆新手" : "通勤时间紧张的人群";
  }
  return `${subjectArea}新手`;
}

function inferValuePromise(text: string, subjectArea: string) {
  if (includesAny(text, ["低预算", "省钱", "不乱买"])) {
    return `把${subjectArea}拆成低预算、可照做的清单`;
  }
  if (includesAny(text, ["避坑", "不踩坑", "别急着"])) {
    return `把${subjectArea}里的高频误区整理成可判断的避坑清单`;
  }
  if (includesAny(text, ["流程", "步骤", "每天"])) {
    return `把${subjectArea}流程拆成每天能执行的小步骤`;
  }
  return `把${subjectArea}问题拆成清晰、稳妥、能执行的选择`;
}

function inferFormats(text: string): BenchmarkContentFormat[] {
  const formats: BenchmarkContentFormat[] = [];
  if (includesAny(text, ["避坑", "别急着", "不乱买", "清单"])) {
    formats.push("避坑清单");
  }
  if (includesAny(text, ["流程", "步骤", "每天", "计划"])) {
    formats.push("流程模板");
  }
  if (includesAny(text, ["对比", "测评", "同价位", "怎么选"])) {
    formats.push("测评对比");
  }
  if (includesAny(text, ["路线", "合集", "地图", "周末"])) {
    formats.push("路线合集");
  }
  return formats.length > 0 ? formats : ["全部"];
}

function inferTone(text: string): string[] {
  const tone = new Set<string>();
  if (includesAny(text, ["低预算", "清单", "步骤", "流程"])) {
    tone.add("实用");
  }
  if (includesAny(text, ["不乱买", "避坑", "别急着"])) {
    tone.add("克制");
  }
  if (includesAny(text, ["小记", "朋友", "新手"])) {
    tone.add("像朋友提醒");
  }
  if (tone.size === 0) {
    tone.add("清晰");
    tone.add("真诚");
  }
  return Array.from(tone);
}

function inferPillars(subjectArea: string, formats: BenchmarkContentFormat[]) {
  if (subjectArea === "家居收纳") {
    return ["空间痛点避坑", "低预算清单", "动线流程", "评论区问题复盘"];
  }
  if (subjectArea === "护肤") {
    return ["成分避坑", "低风险流程", "场景自查", "评论区问题复盘"];
  }
  if (subjectArea === "美妆") {
    return ["场景妆容流程", "产品取舍", "肤色适配", "评论区答疑"];
  }
  if (formats.includes("路线合集")) {
    return ["路线合集", "场景清单", "拍照避坑", "评论区补充"];
  }
  return ["痛点避坑", "流程模板", "对比判断", "评论区问题复盘"];
}

function scoreProfile(input: AccountHomepageInput, formats: BenchmarkContentFormat[]) {
  let score = 45;
  if (compact(input.displayName).length >= 2) score += 10;
  if (compact(input.bio).length >= 12) score += 15;
  if (compact(input.recentNotesText).length >= 24) score += 15;
  if (!formats.includes("全部")) score += 10;
  if (includesAny(`${input.bio} ${input.recentNotesText}`, ["租房", "新手", "敏感肌", "通勤"])) score += 5;
  return Math.min(95, score);
}

export function analyzeAccountHomepage(input: AccountHomepageInput): AccountHomepageAnalysis {
  const text = compact(`${input.displayName} ${input.bio} ${input.recentNotesText}`);
  const inferredSubjectArea = inferSubjectArea(text);
  const inferredAudience = inferAudience(text, inferredSubjectArea);
  const valuePromise = inferValuePromise(text, inferredSubjectArea);
  const contentFormats = inferFormats(text);
  const toneKeywords = inferTone(text);
  const contentPillars = inferPillars(inferredSubjectArea, contentFormats);
  const profileHealthScore = scoreProfile(input, contentFormats);

  return {
    id: `account-homepage-${slug(input.displayName)}-${input.projectId}`,
    projectId: input.projectId,
    profileUrl: input.profileUrl,
    displayName: input.displayName,
    inferredSubjectArea,
    inferredAudience,
    valuePromise,
    toneKeywords,
    contentPillars,
    benchmarkFilters: {
      subjectArea: inferredSubjectArea,
      contentFormats,
    },
    strengths: [
      `${inferredSubjectArea}主体区较清晰`,
      `${inferredAudience}人群可以继续细分`,
      contentFormats.includes("全部") ? "内容形式还可以再收窄" : "内容形式具备对标拆解基础",
    ],
    risks: [
      "主页简介要避免绝对化承诺",
      "近期笔记需要持续围绕同一主体区积累标签信号",
    ],
    opportunities: [
      `围绕${contentPillars[0]}做系列化选题`,
      `优先拆解${inferredSubjectArea}下的高收藏对标内容`,
      "把评论区高频问题沉淀成下一轮选题池",
    ],
    nextActions: [
      `先按${inferredSubjectArea}筛选对标内容`,
      `优先查看${contentFormats[0]}形式的爆款结构`,
      "再进入 Content Studio 生成首篇图文草稿",
    ],
    profileHealthScore,
    createdAt: "2026-07-07T10:00:00.000Z",
  };
}

export function buildPositioningInputFromHomepage(
  analysis: AccountHomepageAnalysis
): AccountPositioningInput {
  return {
    projectId: analysis.projectId,
    subjectArea: analysis.inferredSubjectArea,
    audience: analysis.inferredAudience,
    differentiator: analysis.valuePromise,
    tone: analysis.toneKeywords.join("、"),
  };
}
