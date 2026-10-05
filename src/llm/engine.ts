// On-device llama.cpp via llama.rn. Expo Go has no native module — callers
// check isNativeLlmLinked() and still save meals. A dev client or store build
// downloads the GGUF into the app's documents folder and runs it locally.

import { TurboModuleRegistry } from 'react-native';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';
import {
  ON_DEVICE_MODEL_BYTES,
  ON_DEVICE_MODEL_FILE,
  ON_DEVICE_MODEL_URL,
  PREVIOUS_ON_DEVICE_MODEL_FILE,
} from './model';

export function isNativeLlmLinked(): boolean {
  try {
    return TurboModuleRegistry.get('RNLlama') != null;
  } catch {
    return false;
  }
}

function modelsDirectory(): Directory {
  return new Directory(Paths.document, 'models');
}

export function onDeviceModelFile(): File {
  return new File(modelsDirectory(), ON_DEVICE_MODEL_FILE);
}

export function isModelReady(): boolean {
  try {
    const file = onDeviceModelFile();
    return file.exists && file.size === ON_DEVICE_MODEL_BYTES;
  } catch {
    return false;
  }
}

/** "GGUF" — the first four bytes of every GGUF file. */
const GGUF_MAGIC = [0x47, 0x47, 0x55, 0x46];

/**
 * True when the file starts with the GGUF magic. The download URL is pinned
 * to a Hugging Face commit over TLS, so this plus the byte count is the
 * integrity check. A full SHA-256 in JavaScript took minutes on Hermes for
 * the 1.1 GB file and showed as a download stuck at 100%.
 */
function looksLikeGguf(file: File): boolean {
  const handle = file.open(FileMode.ReadOnly);
  try {
    const head = handle.readBytes(GGUF_MAGIC.length);
    return head.length === GGUF_MAGIC.length && GGUF_MAGIC.every((b, i) => head[i] === b);
  } finally {
    try {
      handle.close();
    } catch {
      // close() must finish so a bad partial can be deleted.
    }
  }
}

let context: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;

async function releaseContext(): Promise<void> {
  const current = context;
  context = null;
  loading = null;
  if (current) {
    try {
      await current.release();
    } catch {
      // A failed release should not block deleting or reloading the file.
    }
  }
}

export async function downloadOnDeviceModel(onProgress?: (fraction: number) => void): Promise<void> {
  const dir = modelsDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const partial = new File(dir, `${ON_DEVICE_MODEL_FILE}.partial`);
  // File.move retargets this handle at dest, so the catch must not delete `partial`.
  const partialPath = partial.uri;
  const dest = onDeviceModelFile();
  try {
    await File.downloadFileAsync(ON_DEVICE_MODEL_URL, partial, {
      idempotent: true,
      onProgress: (data) => {
        if (!onProgress || data.totalBytes <= 0) return;
        onProgress(Math.min(1, data.bytesWritten / data.totalBytes));
      },
    });
    if (partial.size !== ON_DEVICE_MODEL_BYTES || !looksLikeGguf(partial)) {
      throw new Error('The model download did not match the expected file.');
    }
    if (dest.exists) dest.delete();
    await partial.move(dest);
    const previous = new File(dir, PREVIOUS_ON_DEVICE_MODEL_FILE);
    if (previous.uri !== dest.uri && previous.exists) previous.delete();
    await releaseContext();
  } catch (err) {
    const leftover = new File(partialPath);
    if (leftover.exists) leftover.delete();
    throw err;
  }
}

export async function deleteOnDeviceModel(): Promise<void> {
  await releaseContext();
  const file = onDeviceModelFile();
  if (file.exists) file.delete();
}

async function llamaContext(): Promise<LlamaContext> {
  if (context) return context;
  if (!isModelReady()) throw new Error('The on-device model is not downloaded.');
  if (!loading) {
    const file = onDeviceModelFile();
    loading = initLlama({
      model: file.uri,
      n_ctx: 2048,
      n_gpu_layers: 99,
    })
      .then((created) => {
        context = created;
        return created;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

/** Run one short completion. Pass a JSON schema for macro estimates. */
export async function completeOnDevice(
  system: string,
  user: string,
  schema: object | null,
  nPredict: number,
  temperature = 0.2,
): Promise<string> {
  const llama = await llamaContext();
  const result = await llama.completion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    n_predict: nPredict,
    temperature,
    stop: ['<|im_end|>', '<|endoftext|>', '</s>'],
    response_format: schema
      ? { type: 'json_schema', json_schema: { strict: true, schema } }
      : { type: 'text' },
  });
  return result.text ?? '';
}
