---
title: LeadLens Qwen3-VL Extractor
emoji: 🪪
colorFrom: indigo
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
python_version: 3.12
app_file: app.py
pinned: false
license: apache-2.0
---

# LeadLens Qwen3-VL business-card extractor

Runs `Qwen/Qwen3-VL-4B-Instruct` on ZeroGPU. The `/extract` endpoint takes a
business-card image plus the system/user prompts and returns the model's raw
text. The LeadLens Next.js backend parses and validates that text.
