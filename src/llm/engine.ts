// On-device llama.cpp via llama.rn. Expo Go has no native module — callers
// check isNativeLlmLinked() and still save meals. A dev client or store build
// downloads the GGUF into the app's documents folder and runs it locally.

import { TurboModuleRegistry } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';
import { ON_DEVICE_MODEL_FILE, ON_DEVICE_MODEL_URL } from './model';

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
    return onDeviceModelFile().exists;
  } catch {
    return false;
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
  const dest = onDeviceModelFile();
  await File.downloadFileAsync(ON_DEVICE_MODEL_URL, dest, {
    idempotent: true,
    onProgress: (data) => {
      if (!onProgress || data.totalBytes <= 0) return;
      onProgress(Math.min(1, data.bytesWritten / data.totalBytes));
    },
  });
  await releaseContext();
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
