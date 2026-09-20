// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/qwen-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/qwen-service")>(
    "@/lib/services/qwen-service",
  );
  return { ...actual, extractLead: vi.fn() };
});

import sharp from "sharp";
import { ExtractionError, extractLead } from "@/lib/services/qwen-service";
import { POST } from "@/app/api/extract/route";

const mockedExtractLead = vi.mocked(extractLead);

async function makePngFile(
  name: string,
  background: { r: number; g: number; b: number } = { r: 10, g: 10, b: 10 },
): Promise<File> {
  const buffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}

function parseSseEvents(text: string) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data:"))
    .map((chunk) => JSON.parse(chunk.slice("data:".length).trim()));
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    mockedExtractLead.mockReset();
  });

  it("rejects an empty upload with 400", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      body: new FormData(),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("emits real stage events in order and attaches timings to the record", async () => {
    mockedExtractLead.mockImplementation(async (_buf, timings) => {
      if (timings) {
        timings.modelRequestMs = 1234;
        timings.modelInferenceMs = 987;
        timings.parsingMs = 1;
      }
      return {
        first_name: "A", last_name: "B", job_title: null, company: null,
        location: null, phone: null, email: null,
      };
    });
    const formData = new FormData();
    formData.append("files", await makePngFile("one.png"));
    const response = await POST(
      new Request("http://localhost/api/extract", { method: "POST", body: formData }),
    );
    const events = parseSseEvents(await response.text());

    const kinds = events
      .filter((e) => e.type === "card_started" || e.type === "card_stage" || e.type === "card_completed")
      .map((e) => (e.type === "card_stage" ? `stage:${e.stage}` : e.type));
    expect(kinds).toEqual([
      "card_started", "stage:preparing", "stage:reading", "stage:validating", "card_completed",
    ]);

    const completed = events.find((e) => e.type === "card_completed");
    expect(completed.record.timings).toMatchObject({
      modelRequestMs: 1234, modelInferenceMs: 987, parsingMs: 1,
    });
    expect(typeof completed.record.timings.imagePreparationMs).toBe("number");
    expect(typeof completed.record.timings.totalMs).toBe("number");
  });

  it("streams per-card progress and still completes when one card fails", async () => {
    let callCount = 0;
    mockedExtractLead.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 2) throw new Error("simulated model failure");
      return {
        first_name: "Rahul",
        last_name: "Sharma",
        job_title: "CEO",
        company: "ABC Corp",
        location: "Delhi",
        phone: "+91 9876543210",
        email: "rahul@abc.com",
      };
    });

    const formData = new FormData();
    formData.append("files", await makePngFile("card1.png", { r: 200, g: 0, b: 0 }));
    formData.append("files", await makePngFile("card2.png", { r: 0, g: 200, b: 0 }));
    formData.append("files", await makePngFile("card3.png", { r: 0, g: 0, b: 200 }));

    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const events = parseSseEvents(await response.text());
    const startedEvents = events.filter((e) => e.type === "card_started");
    const failedEvents = events.filter((e) => e.type === "card_failed");
    const doneEvent = events.find((e) => e.type === "done");

    expect(startedEvents).toHaveLength(3);
    expect(failedEvents).toHaveLength(1);
    expect(mockedExtractLead).toHaveBeenCalledTimes(3);

    expect(doneEvent).toBeDefined();
    expect(doneEvent.records).toHaveLength(3);
    expect(doneEvent.summary.total).toBe(3);
    expect(doneEvent.summary.failed).toBe(1);
    expect(doneEvent.summary.extracted + doneEvent.summary.needsReview).toBe(2);
  });

  it("rejects an unsupported file type before calling the model", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([1, 2, 3, 4])], "not-an-image.txt", {
        type: "text/plain",
      }),
    );

    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      body: formData,
    });
    const response = await POST(request);
    const events = parseSseEvents(await response.text());
    const doneEvent = events.find((e) => e.type === "done");

    expect(doneEvent.summary.failed).toBe(1);
    expect(mockedExtractLead).not.toHaveBeenCalled();
  });

  it("shows an honest, non-leaky message when the AI provider is unavailable", async () => {
    mockedExtractLead.mockRejectedValue(
      new ExtractionError("provider_unavailable", "SECRET-INTERNAL-DETAIL credit card", 403),
    );

    const formData = new FormData();
    formData.append("files", await makePngFile("a.png", { r: 1, g: 2, b: 3 }));

    const response = await POST(
      new Request("http://localhost/api/extract", { method: "POST", body: formData }),
    );
    const text = await response.text();
    const done = parseSseEvents(text).find((e) => e.type === "done");

    expect(done.summary.failed).toBe(1);
    expect(done.records[0].failureReason).toMatch(/unavailable/i);
    expect(text).not.toContain("SECRET-INTERNAL-DETAIL");
  });
});

describe("POST /api/extract size guards", () => {
  it("rejects an oversized Content-Length with 413 before reading the body", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024 * 1024) },
      body: new FormData(),
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
  });
});
