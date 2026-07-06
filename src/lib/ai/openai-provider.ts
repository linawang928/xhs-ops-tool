type JsonSchema = Record<string, unknown>;

type Fetcher = typeof fetch;

interface OpenAIBaseInput {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
}

interface StructuredTextInput extends OpenAIBaseInput {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: JsonSchema;
}

interface PosterImageInput extends OpenAIBaseInput {
  model?: string;
  prompt: string;
  aspectRatio: "3:4" | "1:1";
}

interface OpenAITextResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
}

function apiBaseUrl(baseUrl?: string) {
  return (baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function requireApiKey(apiKey?: string) {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is required to call OpenAI generation APIs.");
  }
  return key;
}

function readTextOutput(response: OpenAITextResponse) {
  const firstContentText = response.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text;
  const text = response.output_text ?? firstContentText;
  if (!text) {
    throw new Error(response.error?.message ?? "OpenAI response did not include output text.");
  }
  return text;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `OpenAI request failed with HTTP ${response.status}`);
  }
  return body;
}

export async function generateStructuredText<T>(input: StructuredTextInput): Promise<T> {
  const apiKey = requireApiKey(input.apiKey);
  const response = await (input.fetcher ?? fetch)(`${apiBaseUrl(input.baseUrl)}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5",
      input: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          schema: input.schema,
          strict: true,
        },
      },
    }),
  });

  return JSON.parse(readTextOutput(await readJsonResponse<OpenAITextResponse>(response))) as T;
}

function imageSizeFor(aspectRatio: PosterImageInput["aspectRatio"]) {
  return aspectRatio === "3:4" ? "1024x1536" : "1024x1024";
}

export async function generatePosterImage(input: PosterImageInput): Promise<{ url: string; alt: string }> {
  const apiKey = requireApiKey(input.apiKey);
  const response = await (input.fetcher ?? fetch)(`${apiBaseUrl(input.baseUrl)}/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt: input.prompt,
      size: imageSizeFor(input.aspectRatio),
      response_format: "b64_json",
    }),
  });

  const body = await readJsonResponse<OpenAIImageResponse>(response);
  const image = body.data?.find((item) => item.b64_json);
  if (!image?.b64_json) {
    throw new Error(body.error?.message ?? "OpenAI image response did not include image data.");
  }

  return {
    url: `data:image/png;base64,${image.b64_json}`,
    alt: image.revised_prompt ?? input.prompt,
  };
}
