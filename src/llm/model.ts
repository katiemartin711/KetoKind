// Small instruct GGUF. Downloaded on demand; not bundled in the app.
// Pinned to the Hugging Face repo's main file. Logs are never uploaded.

export const ON_DEVICE_MODEL_FILE = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

export const ON_DEVICE_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf';

/** Approximate download size, for the prompt copy. */
export const ON_DEVICE_MODEL_MB = 500;
