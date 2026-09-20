import { afterEach, describe, expect, it } from "vitest";
import { describeModel, getModelConfig } from "@/lib/config/model";

const KEYS = ["QWEN_BASE_URL", "QWEN_MODEL", "QWEN_API_KEY", "AI_GATEWAY_MODEL"] as const;

describe("getModelConfig", () => {
  afterEach(() => {
    for (const k of KEYS) delete process.env[k];
  });

  it("defaults to the gateway when no self-hosted endpoint is configured", () => {
    expect(getModelConfig()).toEqual({ provider: "gateway", model: "alibaba/qwen3.5-flash" });
  });

  it("uses the self-hosted endpoint when QWEN_BASE_URL is set", () => {
    process.env.QWEN_BASE_URL = "http://10.0.0.5:8000/v1";
    process.env.QWEN_MODEL = "Qwen/Qwen3-VL-4B-Instruct";
    process.env.QWEN_API_KEY = "k";
    expect(getModelConfig()).toEqual({
      provider: "self-hosted",
      model: "Qwen/Qwen3-VL-4B-Instruct",
      baseURL: "http://10.0.0.5:8000/v1",
      apiKey: "k",
    });
  });

  it("refuses to guess a model name for a self-hosted endpoint", () => {
    process.env.QWEN_BASE_URL = "http://10.0.0.5:8000/v1";
    expect(() => getModelConfig()).toThrow(/QWEN_MODEL/);
  });

  it("never exposes the endpoint URL or key in the public description", () => {
    process.env.QWEN_BASE_URL = "http://10.0.0.5:8000/v1";
    process.env.QWEN_MODEL = "Qwen/Qwen3-VL-4B-Instruct";
    process.env.QWEN_API_KEY = "super-secret";
    const text = JSON.stringify(describeModel());
    expect(text).not.toContain("10.0.0.5");
    expect(text).not.toContain("super-secret");
    expect(describeModel()).toEqual({ provider: "self-hosted", model: "Qwen/Qwen3-VL-4B-Instruct" });
  });
});

describe("getModelConfig (Hugging Face Space)", () => {
  afterEach(() => {
    for (const k of ["QWEN_BASE_URL", "HF_SPACE_ID", "HF_TOKEN", "HF_SPACE_MODEL"]) delete process.env[k];
  });

  it("uses the Space when HF_SPACE_ID is set", () => {
    process.env.HF_SPACE_ID = "me/leadlens";
    process.env.HF_TOKEN = "hf_abc";
    expect(getModelConfig()).toEqual({
      provider: "hf-space",
      model: "Qwen/Qwen3-VL-4B-Instruct",
      spaceId: "me/leadlens",
      token: "hf_abc",
    });
  });

  it("prefers a self-hosted endpoint over the Space", () => {
    process.env.HF_SPACE_ID = "me/leadlens";
    process.env.QWEN_BASE_URL = "http://10.0.0.5:8000/v1";
    process.env.QWEN_MODEL = "m";
    expect(getModelConfig().provider).toBe("self-hosted");
  });

  it("never exposes the Space id or token in the public description", () => {
    process.env.HF_SPACE_ID = "me/leadlens";
    process.env.HF_TOKEN = "hf_secret";
    const text = JSON.stringify(describeModel());
    expect(text).not.toContain("hf_secret");
    expect(text).not.toContain("me/leadlens");
  });
});
