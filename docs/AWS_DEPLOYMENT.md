# AWS deployment runbook (self-hosted Qwen3-VL)

> **Status: NOT EXECUTED.** Nothing in this document has been run on AWS. It was
> written from the vLLM and Docker documentation and validated only for compose
> syntax (`docker compose config`). No AWS credentials or CLI were available when
> it was written. Treat every command as a draft to verify on a real instance,
> and treat every price as an unverified estimate — check the AWS pricing page.

## What gets deployed

One GPU EC2 instance running three containers from `docker/docker-compose.aws.yml`:

```
Internet ──443──▶ caddy (TLS) ──▶ app (Next.js) ──▶ vllm (Qwen3-VL)
                                          Docker network only, never public
```

- `vllm` serves `Qwen/Qwen3-VL-4B-Instruct` (Apache-2.0, ~4.4B parameters,
  verified on Hugging Face) through an OpenAI-compatible API.
- `app` is this repository's image, configured with `QWEN_BASE_URL=http://vllm:8000/v1`.
- `caddy` terminates HTTPS and streams the SSE progress events unbuffered.

The model server is deliberately **not** published to the host or the internet.

## Why not the AWS free tier

Free-tier instances (t2/t3.micro) have 1 GB of RAM and no GPU; they cannot load a
4B-parameter vision model. A CPU-only larger instance could run a small Qwen-VL
very slowly — that path is untested and not recommended. Running Qwen on AWS
**costs money**. Accepting that cost is the only way to satisfy "deploy Qwen on
AWS" with a real model.

## Instance sizing (estimates — verify)

| Option | GPU | Fit | Notes |
| --- | --- | --- | --- |
| `g5.xlarge` (recommended) | 1× NVIDIA A10G, 24 GB | 4B in bf16 (~9 GB weights) fits with room for KV cache and the vision encoder | Ampere supports bf16 |
| `g4dn.xlarge` | 1× NVIDIA T4, 16 GB | Fits, but T4 has no bf16; vLLM needs `--dtype half`, and fp16 stability for this model is unverified | Cheaper |

Approximate on-demand rates are on the order of $0.5–$1.0 per hour depending on
type and region. **Verify on the AWS EC2 pricing page before launching.** Stop the
instance when not demoing; a stopped instance still bills for its EBS volume.

## Blockers to expect

1. **GPU vCPU quota.** New accounts commonly have a default quota of 0 for
   "Running On-Demand G and VT instances". Request an increase in Service Quotas
   *before* anything else; approval can take hours to days.
2. **A DNS name** for HTTPS. Caddy obtains a certificate for `SITE_ADDRESS`
   automatically, but only if that name resolves to the instance's public IP.
3. **First start is slow.** vLLM downloads the model weights on first boot.

## Steps

1. Launch a GPU instance (Ubuntu, an NVIDIA-driver-enabled Deep Learning AMI is
   the easiest base — confirm it ships Docker and the NVIDIA container toolkit,
   otherwise install them). Use ≥100 GB gp3 storage. Allocate and attach an
   Elastic IP.
2. Security group: inbound **80** and **443** from anywhere; **22 from your IP
   only**. Do **not** open 8000.
3. Point a DNS `A` record at the Elastic IP.
4. On the instance:
   ```bash
   git clone <your-repo-url> leadlens && cd leadlens
   export QWEN_API_KEY=$(openssl rand -hex 24)   # shared secret between app and vllm
   export SITE_ADDRESS=leads.example.com
   docker compose -f docker/docker-compose.aws.yml up -d --build
   docker compose -f docker/docker-compose.aws.yml logs -f vllm   # wait for "Application startup complete"
   ```
5. Verify: `curl https://$SITE_ADDRESS/api/health` should report
   `"provider":"self-hosted"`, then run a real extraction through the UI.

## Things to verify on the real instance (currently unknown)

- The exact `vllm/vllm-openai` tag to pin (Qwen3-VL needs vLLM ≥ 0.11.0 per the
  vLLM Qwen3-VL recipe) and that the flags in the compose file are accepted by it.
- Whether `response_format: json_schema` works **together with image input**. The
  vLLM docs confirm JSON-schema output but do not say it is supported alongside
  multimodal input. If it is not, the app still recovers JSON from plain text
  (`src/lib/utils/json-parser.ts`).
- Real latency and throughput. The only timings recorded so far are from a
  quantized model on a 16 GB Apple-silicon laptop and say nothing about AWS.

## Access control

The public URL has **no authentication**: anyone who finds it can spend your GPU
time. Before sharing it widely, add Caddy `basicauth` or restrict the security
group to known IPs.

## Teardown

Stop the instance to stop compute charges. Terminate it and delete the EBS volume
and Elastic IP to stop all charges.
