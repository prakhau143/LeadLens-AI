import json
import time

import gradio as gr
import spaces
import torch
from PIL import Image
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

MODEL_ID = "Qwen/Qwen3-VL-4B-Instruct"
MAX_NEW_TOKENS = 200  # the reply is one small JSON object

# Loaded on "cuda" at module level as ZeroGPU requires; real GPU attaches only
# inside @spaces.GPU functions.
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = Qwen3VLForConditionalGeneration.from_pretrained(
    MODEL_ID, torch_dtype=torch.bfloat16
).to("cuda")


# ZeroGPU checks this against the remaining daily quota *before* running, so
# keep it close to real need (warm inference measured at ~4-5 s).
@spaces.GPU(duration=25)
def extract(image: Image.Image, system_prompt: str, user_prompt: str):
    started = time.perf_counter()  # starts after the GPU is attached
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image.convert("RGB")},
                {"type": "text", "text": user_prompt},
            ],
        },
    ]
    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)
    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
    trimmed = out[:, inputs["input_ids"].shape[1]:]
    text = processor.batch_decode(trimmed, skip_special_tokens=True)[0]
    return text, json.dumps({"inference_ms": round((time.perf_counter() - started) * 1000)})


demo = gr.Interface(
    fn=extract,
    inputs=[
        gr.Image(type="pil", label="Business card"),
        gr.Textbox(label="System prompt"),
        gr.Textbox(label="User prompt"),
    ],
    outputs=[gr.Textbox(label="Raw model output"), gr.Textbox(label="Timing (JSON)")],
    api_name="extract",
    title="LeadLens Qwen3-VL extractor",
)

if __name__ == "__main__":
    demo.queue(max_size=8).launch()
