// @vitest-environment node
// Exercises the REAL extractLead()/generateObject path against a local fake
// OpenAI-compatible server that returns deliberately bad model output.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { extractLead } from "@/lib/services/qwen-service";

const GOOD = {
  first_name: "Priya", last_name: "Nair", job_title: "PM", company: "Meridian",
  location: null, phone: "+91 98450 12345", email: "priya@meridian.in",
};

let reply: string[] = [];
let calls = 0;
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const content = reply[Math.min(calls, reply.length - 1)];
      calls += 1;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        id: "x", object: "chat.completion", created: 0, model: "fake",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.QWEN_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.QWEN_MODEL = "fake-qwen";
});
afterAll(() => {
  server.close();
  delete process.env.QWEN_BASE_URL;
  delete process.env.QWEN_MODEL;
});
beforeEach(() => { calls = 0; });

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe("malformed model output", () => {
  it("accepts clean JSON", async () => {
    reply = [JSON.stringify(GOOD)];
    await expect(extractLead(png)).resolves.toEqual(GOOD);
  });
  it("accepts JSON with leading/trailing whitespace (seen from real Qwen3-VL)", async () => {
    reply = ["\n" + JSON.stringify(GOOD, null, 4) + "\n"];
    await expect(extractLead(png)).resolves.toEqual(GOOD);
  });
  it("recovers JSON wrapped in a Markdown fence", async () => {
    reply = ["```json\n" + JSON.stringify(GOOD) + "\n```"];
    await expect(extractLead(png)).resolves.toEqual(GOOD);
  });
  it("recovers JSON surrounded by explanatory prose", async () => {
    reply = ["Here is the extracted information:\n" + JSON.stringify(GOOD) + "\nHope that helps!"];
    await expect(extractLead(png)).resolves.toEqual(GOOD);
  });
  it("fails cleanly (classified, not thrown raw) on unrecoverable garbage", async () => {
    reply = ["I could not read this card."];
    await expect(extractLead(png)).rejects.toMatchObject({ code: "model_output" });
  });
  it("rejects schema-violating output (wrong types) instead of accepting it", async () => {
    reply = [JSON.stringify({ ...GOOD, phone: 9845012345 })];
    await expect(extractLead(png)).rejects.toMatchObject({ code: "model_output" });
  });
});
