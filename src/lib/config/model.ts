const DEFAULT_GATEWAY_MODEL = "alibaba/qwen3.5-flash";
const DEFAULT_HF_SPACE_MODEL = "Qwen/Qwen3-VL-4B-Instruct";

export type ModelConfig =
  | { provider: "self-hosted"; model: string; baseURL: string; apiKey?: string }
  | { provider: "hf-space"; model: string; spaceId: string; token?: string }
  | { provider: "gateway"; model: string };

/**
 * Where Qwen inference runs:
 *  - QWEN_BASE_URL set  -> a self-hosted OpenAI-compatible server
 *    (vLLM on AWS in production, Ollama for local development).
 *  - HF_SPACE_ID set    -> a Qwen3-VL Gradio Space on Hugging Face (ZeroGPU).
 *  - otherwise          -> Vercel AI Gateway (hosted; NOT a self-deployed model).
 */
export function getModelConfig(): ModelConfig {
  const baseURL = process.env.QWEN_BASE_URL?.trim();
  if (baseURL) {
    const model = process.env.QWEN_MODEL?.trim();
    if (!model) {
      throw new Error("QWEN_MODEL must be set when QWEN_BASE_URL is set");
    }
    return {
      provider: "self-hosted",
      model,
      baseURL,
      apiKey: process.env.QWEN_API_KEY?.trim() || undefined,
    };
  }
  const spaceId = process.env.HF_SPACE_ID?.trim();
  if (spaceId) {
    return {
      provider: "hf-space",
      model: process.env.HF_SPACE_MODEL?.trim() || DEFAULT_HF_SPACE_MODEL,
      spaceId,
      token: process.env.HF_TOKEN?.trim() || undefined,
    };
  }
  return {
    provider: "gateway",
    model: process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_GATEWAY_MODEL,
  };
}

/** Safe-to-expose description (never includes the endpoint URL or keys). */
export function describeModel(): { provider: string; model: string } {
  try {
    const c = getModelConfig();
    return { provider: c.provider, model: c.model };
  } catch {
    return { provider: "misconfigured", model: "unknown" };
  }
}
