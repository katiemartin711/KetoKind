// On-device llama.cpp via llama.rn. Expo Go has no native module — callers
// check isNativeLlmLinked() and still save meals. A dev client or store build
// downloads the GGUF into the app's documents folder and runs it locally.

import { TurboModuleRegistry } from 'react-native';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';
import {
  ON_DEVICE_MODEL_BYTES,
  ON_DEVICE_MODEL_FILE,
  ON_DEVICE_MODEL_SHA256,
  ON_DEVICE_MODEL_URL,
} from './model';
import { IncrementalSha256 } from './sha256';

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

/** Bytes per FileHandle.readBytes call. Stays well under the Android signed-int cap. */
const HASH_CHUNK_BYTES = 1024 * 1024;

/**
 * SHA-256 hex of a file, read with FileHandle.readBytes.
 * SDK 57 Crypto.digest takes one BufferSource and does not stream, so this
 * does not call File.bytes(). The hex matches that digest. The handle is
 * closed before return so the caller can move or delete the file.
 */
async function sha256File(file: File): Promise<string> {
  const handle = file.open(FileMode.ReadOnly);
  const hash = new IncrementalSha256();
  try {
    const total = file.size;
    let read = 0;
    while (read < total) {
      const want = Math.min(HASH_CHUNK_BYTES, total - read);
      const chunk = handle.readBytes(want);
      if (chunk.length === 0 || chunk.length > want) {
        throw new Error('Could not read the model file.');
      }
      hash.update(chunk);
      read += chunk.length;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    if (read !== total) throw new Error('Could not read the model file.');
    return hash.digestHex();
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
    if (partial.size !== ON_DEVICE_MODEL_BYTES) {
      throw new Error('The model download did not match the expected file.');
    }
    const hash = await sha256File(partial);
    if (hash !== ON_DEVICE_MODEL_SHA256) {
      throw new Error('The model download did not match the expected file.');
    }
    if (dest.exists) dest.delete();
    await partial.move(dest);
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
): Promise<string> {
  const llama = await llamaContext();
  const result = await llama.completion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    n_predict: nPredict,
    temperature: 0.2,
    stop: ['<|im_end|>', '<|endoftext|>', '</s>'],
    response_format: schema
      ? { type: 'json_schema', json_schema: { strict: true, schema } }
      : { type: 'text' },
  });
  return result.text ?? '';
}
