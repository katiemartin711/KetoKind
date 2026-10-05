// Small instruct GGUF. Downloaded on demand; not bundled in the app.
// Pinned to the Hugging Face repo's main file. Logs are never uploaded.

export const ON_DEVICE_MODEL_FILE = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';

export const ON_DEVICE_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf';

/** SHA-256 of the pinned GGUF at ON_DEVICE_MODEL_URL, kept for reference.
 *  Command: sha256sum of the Hugging Face file at the pinned revision.
 *  Not checked at runtime: hashing 1.1 GB in JavaScript took minutes on the
 *  phone. The download is verified by byte count and GGUF magic instead.
 */
export const ON_DEVICE_MODEL_SHA256: string =
  '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e';

/** Byte length of that same GGUF. */
export const ON_DEVICE_MODEL_BYTES = 1117320736;

/** Previous download. Removed after the 1.5B file is installed. */
export const PREVIOUS_ON_DEVICE_MODEL_FILE = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

/** Approximate download size, for the prompt copy. */
export const ON_DEVICE_MODEL_MB = Math.round(ON_DEVICE_MODEL_BYTES / (1024 * 1024));
