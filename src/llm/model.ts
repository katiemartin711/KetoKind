// Small instruct GGUF. Downloaded on demand; not bundled in the app.
// Pinned to the Hugging Face repo's main file. Logs are never uploaded.

export const ON_DEVICE_MODEL_FILE = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

export const ON_DEVICE_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf';

/** SHA-256 of the pinned GGUF at ON_DEVICE_MODEL_URL.
 *  Command: sha256sum of the Hugging Face file at the pinned revision.
 */
export const ON_DEVICE_MODEL_SHA256: string =
  '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db';

/** Byte length of that same GGUF. */
export const ON_DEVICE_MODEL_BYTES = 491400032;

/** Approximate download size, for the prompt copy. */
export const ON_DEVICE_MODEL_MB = Math.round(ON_DEVICE_MODEL_BYTES / (1024 * 1024));
