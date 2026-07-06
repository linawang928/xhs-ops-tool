export interface AiProviderStatusPayload {
  serverApiAvailable: boolean;
  hasOpenAIKey: boolean;
  textModel: string;
  imageModel: string;
  features: {
    structuredText: boolean;
    posterImage: boolean;
  };
}

export function getAiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatusPayload {
  const hasKey = Boolean(env.OPENAI_API_KEY?.trim());
  const imageModel = env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

  return {
    serverApiAvailable: true,
    hasOpenAIKey: hasKey,
    textModel: env.OPENAI_TEXT_MODEL ?? "gpt-5.5",
    imageModel,
    features: {
      structuredText: hasKey,
      posterImage: hasKey && imageModel.startsWith("gpt-image"),
    },
  };
}
