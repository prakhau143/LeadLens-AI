import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  NoObjectGeneratedError: {
    isInstance: (e: unknown) => (e as { name?: string })?.name === "NoObjectGeneratedError",
  },
}));

import { generateObject } from "ai";
import { ExtractionError, extractLead } from "@/lib/services/qwen-service";

const mockedGenerateObject = vi.mocked(generateObject);

function httpError(statusCode: number, message = "boom") {
  return Object.assign(new Error(message), { statusCode });
}

describe("extractLead", () => {
  beforeEach(() => {
    mockedGenerateObject.mockReset();
    delete process.env.QWEN_BASE_URL;
    delete process.env.QWEN_MODEL;
  });

  it("routes to the self-hosted Qwen endpoint when QWEN_BASE_URL is set", async () => {
    process.env.QWEN_BASE_URL = "http://127.0.0.1:8000/v1";
    process.env.QWEN_MODEL = "Qwen/Qwen3-VL-4B-Instruct";
    mockedGenerateObject.mockResolvedValueOnce({ object: { first_name: "X" } } as never);

    await extractLead(Buffer.from("fake-image"));

    const model = mockedGenerateObject.mock.calls[0][0].model as { modelId: string };
    expect(typeof model).toBe("object");
    expect(model.modelId).toBe("Qwen/Qwen3-VL-4B-Instruct");
  });

  it("uses a plain gateway model string when no self-hosted endpoint is set", async () => {
    mockedGenerateObject.mockResolvedValueOnce({ object: { first_name: "X" } } as never);
    await extractLead(Buffer.from("fake-image"));
    expect(mockedGenerateObject.mock.calls[0][0].model).toBe("alibaba/qwen3.5-flash");
  });

  it("returns the extracted object on the first try", async () => {
    mockedGenerateObject.mockResolvedValueOnce({ object: { first_name: "Rahul" } } as never);

    const result = await extractLead(Buffer.from("fake-image"));
    expect(result).toEqual({ first_name: "Rahul" });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("retries once after a transient failure and succeeds", async () => {
    mockedGenerateObject
      .mockRejectedValueOnce(httpError(500, "provider hiccup"))
      .mockResolvedValueOnce({ object: { first_name: "Sarah" } } as never);

    const result = await extractLead(Buffer.from("fake-image"));
    expect(result).toEqual({ first_name: "Sarah" });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(2);
  });

  it("throws a classified error when both attempts fail", async () => {
    mockedGenerateObject
      .mockRejectedValueOnce(httpError(500, "first failure"))
      .mockRejectedValueOnce(httpError(500, "second failure"));

    const promise = extractLead(Buffer.from("fake-image"));
    await expect(promise).rejects.toBeInstanceOf(ExtractionError);
    await expect(promise).rejects.toMatchObject({ code: "unknown", message: "second failure" });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(2);
  });

  it.each([401, 402, 403])(
    "does NOT retry a permanent %i auth/billing error",
    async (status) => {
      mockedGenerateObject.mockRejectedValue(httpError(status, "no credit card"));

      await expect(extractLead(Buffer.from("fake-image"))).rejects.toMatchObject({
        code: "provider_unavailable",
        statusCode: status,
      });
      expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
    },
  );

  it("classifies malformed model output", async () => {
    const malformed = Object.assign(new Error("could not parse"), {
      name: "NoObjectGeneratedError",
    });
    mockedGenerateObject.mockRejectedValue(malformed);

    await expect(extractLead(Buffer.from("fake-image"))).rejects.toMatchObject({
      code: "model_output",
    });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(2);
  });

  it("treats an 'Unauthenticated' error without a status code as permanent (no retry)", async () => {
    mockedGenerateObject.mockRejectedValue(new Error("Unauthenticated. Configure AI_GATEWAY_API_KEY"));
    await expect(extractLead(Buffer.from("x"))).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("classifies a refused connection as unreachable and retries once", async () => {
    const refused = Object.assign(new Error("Cannot connect to API"), { cause: { code: "ECONNREFUSED" } });
    mockedGenerateObject.mockRejectedValue(refused);
    await expect(extractLead(Buffer.from("x"))).rejects.toMatchObject({ code: "provider_unreachable" });
    expect(mockedGenerateObject).toHaveBeenCalledTimes(2);
  });
});

describe("extractLead via Hugging Face Space", () => {
  const predict = vi.fn();
  afterEach(() => {
    delete process.env.HF_SPACE_ID;
  });
  beforeEach(async () => {
    predict.mockReset();
    mockedGenerateObject.mockReset();
    process.env.HF_SPACE_ID = "me/leadlens";
    vi.resetModules();
    vi.doMock("@gradio/client", () => ({
      Client: { connect: vi.fn().mockResolvedValue({ predict }) },
    }));
  });

  async function load() {
    return (await import("@/lib/services/qwen-service")).extractLead;
  }

  it("parses fenced JSON returned by the Space and validates it", async () => {
    predict.mockResolvedValueOnce({
      data: ['Here you go:\n```json\n{"first_name":"Morgan","last_name":"Maxwell","job_title":null,"company":null,"location":null,"phone":null,"email":null}\n```'],
    });
    const lead = await (await load())(Buffer.from("img"));
    expect(lead.first_name).toBe("Morgan");
    expect(mockedGenerateObject).not.toHaveBeenCalled();
  });

  it("fails as model_output (no fake lead) when the reply has no JSON", async () => {
    predict.mockResolvedValue({ data: ["sorry, cannot read"] });
    await expect((await load())(Buffer.from("img"))).rejects.toMatchObject({ code: "model_output" });
  });

  it("does not retry once the ZeroGPU quota is exhausted", async () => {
    predict.mockRejectedValue(new Error("You have exceeded your free ZeroGPU quota (90s requested vs. 73s left)."));
    await expect((await load())(Buffer.from("img"))).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(predict).toHaveBeenCalledTimes(1);
  });
});
