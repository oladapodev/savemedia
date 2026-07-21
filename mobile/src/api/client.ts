import type {
  ApiFailure,
  DirectDownload,
  DownloadResult,
  Fetcher,
  MediaApi,
  PickerDownload,
  PreviewResult,
} from './types';
import type { MediaType } from '../downloads/types';
import { filenameForConcreteMediaMime, inferConcreteMediaMime } from '../files/mime';

type ApiOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMediaType(value: unknown): value is MediaType {
  return value === 'video' || value === 'audio' || value === 'image';
}

function previewMediaType(value: unknown): MediaType | undefined {
  if (isMediaType(value)) return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  if (/\b(photo|image|picture)\b/u.test(normalized)) return 'image';
  if (/\b(audio|sound)\b/u.test(normalized)) return 'audio';
  if (/\b(video|rich)\b/u.test(normalized)) return 'video';
  return undefined;
}

function isPublicHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function failure(
  reason: ApiFailure['reason'],
  message: string,
  retryable: boolean,
  status?: number,
): ApiFailure {
  return { kind: 'failure', reason, message, retryable, ...(status ? { status } : {}) };
}

function publicBase(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.port === '9000') return null;
    if (/(^|[.-])cobalt([.-]|$)/iu.test(parsed.hostname)) return null;
    return parsed.origin.replace(/\/+$/u, '');
  } catch {
    return null;
  }
}

function responseMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback;
  return typeof body.error === 'string' && body.error.trim() ? body.error : fallback;
}

function classifyWrapperFailure(
  status: number,
  message: string,
): ApiFailure['reason'] {
  const normalized = message.toLowerCase();
  if (
    /\b(private|login(?:-only)?|account access|authentication|age-restricted|region-locked|protected)\b/u.test(
      normalized,
    )
  ) {
    return 'private';
  }
  if (
    status === 404 ||
    /\b(not found|deleted|unavailable|no downloadable content)\b/u.test(normalized)
  ) {
    return 'not_found';
  }
  if (/\b(unsupported|not supported|local processing)\b/u.test(normalized)) {
    return 'unsupported';
  }
  return 'provider';
}

function parsePreview(body: unknown): PreviewResult | null {
  if (!isRecord(body) || body.success !== true) return null;
  if (typeof body.platform !== 'string' || typeof body.url !== 'string') return null;
  const mediaType = previewMediaType(body.type);
  return {
    kind: 'preview',
    platform: body.platform,
    url: body.url,
    ...(typeof body.title === 'string' ? { title: body.title } : {}),
    ...(typeof body.author === 'string' ? { author: body.author } : {}),
    ...(typeof body.thumbnail === 'string' ? { thumbnail: body.thumbnail } : {}),
    ...(mediaType ? { mediaType } : {}),
  };
}

function parseDownload(body: unknown): DownloadResult | null {
  if (!isRecord(body) || body.success !== true || typeof body.platform !== 'string') {
    return null;
  }

  if (body.multiple === true && Array.isArray(body.items)) {
    const items = body.items.map((item, index) => {
      if (!isRecord(item) || !isPublicHttpUrl(item.url) || !isMediaType(item.type)) return null;
      const filename = typeof item.filename === 'string' && item.filename
        ? item.filename
        : `${body.platform}-media-${index + 1}`;
      const mimeType = inferConcreteMediaMime({
        declaredMimeType: item.mimeType,
        filename,
        mediaType: item.type,
        url: item.url,
      });
      if (!mimeType) return null;
      return {
        id: `item-${index + 1}`,
        downloadUrl: item.url,
        mediaType: item.type,
        filename: filenameForConcreteMediaMime(filename, mimeType),
        mimeType,
      };
    });
    if (items.some((item) => item === null) || items.length === 0) return null;
    return { kind: 'picker', platform: body.platform, items: items as PickerDownload['items'] };
  }

  if (
    !isPublicHttpUrl(body.downloadUrl) ||
    typeof body.filename !== 'string' ||
    !isMediaType(body.type)
  ) {
    return null;
  }
  const mimeType = inferConcreteMediaMime({
    declaredMimeType: body.mimeType,
    filename: body.filename,
    mediaType: body.type,
    url: body.downloadUrl,
  });
  if (!mimeType) return null;
  return {
    kind: 'direct',
    platform: body.platform,
    downloadUrl: body.downloadUrl,
    filename: filenameForConcreteMediaMime(body.filename, mimeType),
    mediaType: body.type,
    mimeType,
  } as DirectDownload;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createApi({ baseUrl, fetcher = fetch }: ApiOptions): MediaApi {
  const base = publicBase(baseUrl);

  async function request(
    path: '/api/preview' | '/api/download',
    body: JsonRecord,
  ): Promise<{ body: unknown; response?: Response } | ApiFailure> {
    if (!base) {
      return failure('invalid_base', 'Use the public iMediaSave wrapper URL.', false);
    }
    try {
      const response = await fetcher(`${base}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const parsed = await parseJson(response);
      if (!response.ok) {
        const message = responseMessage(
          parsed,
          'The download service could not complete the request.',
        );
        const reason = classifyWrapperFailure(response.status, message);
        return failure(
          reason,
          message,
          reason === 'provider' && (response.status === 429 || response.status >= 500),
          response.status,
        );
      }
      return { body: parsed, response };
    } catch {
      return failure('network', 'Could not reach the iMediaSave service.', true);
    }
  }

  return {
    async preview(url) {
      const result = await request('/api/preview', { url });
      if ('kind' in result) return result;
      return (
        parsePreview(result.body) ??
        failure('malformed', 'The preview service returned an unexpected response.', false)
      );
    },
    async download(url, quality) {
      const result = await request('/api/download', { url, quality });
      if ('kind' in result) return result;
      return (
        parseDownload(result.body) ??
        failure('malformed', 'The download service returned an unexpected response.', false)
      );
    },
  };
}
