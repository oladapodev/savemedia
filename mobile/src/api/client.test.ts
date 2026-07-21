import { createApi } from './client';

const reelUrl = 'https://www.instagram.com/reel/abc';
const mediaUrl = 'https://cdn.example.com/clip.mp4';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('public iMediaSave API client', () => {
  test('preview posts JSON to the wrapper after removing a trailing slash', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        platform: 'instagram',
        url: reelUrl,
        title: 'Reel',
        type: 'video',
      }),
    );

    const result = await createApi({ baseUrl: 'https://app.example/', fetcher }).preview(reelUrl);

    expect(fetcher).toHaveBeenCalledWith(
      'https://app.example/api/preview',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: reelUrl }),
      }),
    );
    expect(result).toMatchObject({ kind: 'preview', platform: 'instagram', title: 'Reel' });
  });

  test('preview accepts provider-specific oEmbed types and keeps its thumbnail', async () => {
    const thumbnail = 'https://cdn.example.com/poster.jpg';
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({
        success: true,
        platform: 'tiktok',
        url: 'https://tiktok.com/@creator/video/1',
        title: 'Creator video',
        thumbnail,
        type: 'rich',
      })),
    }).preview('https://tiktok.com/@creator/video/1');

    expect(result).toMatchObject({ kind: 'preview', mediaType: 'video', thumbnail, title: 'Creator video' });
  });

  test('maps a direct download response without accepting cobalt fields', async () => {
    const result = await createApi({
      baseUrl: 'http://localhost:3000',
      fetcher: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          platform: 'instagram',
          downloadUrl: mediaUrl,
          filename: 'clip.mp4',
          type: 'video',
          mimeType: 'video/mp4',
        }),
      ),
    }).download(reelUrl, 'balanced');

    expect(result).toEqual({
      kind: 'direct',
      platform: 'instagram',
      downloadUrl: mediaUrl,
      filename: 'clip.mp4',
      mediaType: 'video',
      mimeType: 'video/mp4',
    });
  });

  test('maps picker responses without losing item identity', async () => {
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          platform: 'instagram',
          multiple: true,
          items: [{ url: mediaUrl, type: 'video', filename: 'clip-1.mp4', mimeType: 'video/mp4' }],
        }),
      ),
    }).download(reelUrl, '720');

    expect(result).toEqual({
      kind: 'picker',
      platform: 'instagram',
      items: [{ id: 'item-1', downloadUrl: mediaUrl, mediaType: 'video', filename: 'clip-1.mp4', mimeType: 'video/mp4' }],
    });
  });

  test('infers a concrete supported MIME from a legacy wrapper filename only when mimeType is absent', async () => {
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({
        success: true,
        platform: 'instagram',
        downloadUrl: 'https://cdn.example.com/photo',
        filename: 'photo.webp',
        type: 'image',
      })),
    }).download(reelUrl, 'original');

    expect(result).toMatchObject({ kind: 'direct', mediaType: 'image', mimeType: 'image/webp' });
  });

  test('preserves concrete audio MIME for audio quality and rejects an unsupported concrete MIME', async () => {
    const audio = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({
        success: true,
        platform: 'youtube',
        downloadUrl: 'https://cdn.example.com/song.mp3',
        filename: 'song.mp3',
        type: 'audio',
        mimeType: 'audio/mpeg',
      })),
    }).download('https://youtube.com/watch?v=one', 'audio');
    const unsupported = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({
        success: true,
        platform: 'instagram',
        downloadUrl: mediaUrl,
        filename: 'clip.mp4',
        type: 'video',
        mimeType: 'application/octet-stream',
      })),
    }).download(reelUrl, 'balanced');

    expect(audio).toMatchObject({ kind: 'direct', mediaType: 'audio', mimeType: 'audio/mpeg' });
    expect(unsupported).toMatchObject({ kind: 'failure', reason: 'malformed' });
  });

  test('rewrites a misleading wrapper filename extension to match the validated concrete MIME', async () => {
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({
        success: true,
        platform: 'instagram',
        downloadUrl: mediaUrl,
        filename: 'clip.webm',
        type: 'video',
        mimeType: 'video/mp4',
      })),
    }).download(reelUrl, 'balanced');

    expect(result).toMatchObject({ kind: 'direct', filename: 'clip.mp4', mimeType: 'video/mp4' });
  });

  test('maps network, non-success, and malformed responses to typed failures', async () => {
    const network = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockRejectedValue(new Error('offline')),
    }).preview(reelUrl);
    const provider = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({ error: 'Try later' }, 502)),
    }).download(reelUrl, 'balanced');
    const malformed = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(jsonResponse({ success: true, platform: 7 })),
    }).preview(reelUrl);

    expect(network).toMatchObject({ kind: 'failure', reason: 'network', retryable: true });
    expect(provider).toMatchObject({ kind: 'failure', reason: 'provider', retryable: true, status: 502 });
    expect(malformed).toMatchObject({ kind: 'failure', reason: 'malformed', retryable: false });
  });

  test.each([
    [400, 'Unsupported platform. Supported: Instagram', 'unsupported'],
    [422, 'This Instagram content is from a private account.', 'private'],
    [404, 'The requested media was not found.', 'not_found'],
    [422, 'This post is unavailable or has been deleted.', 'not_found'],
  ] as const)(
    'maps wrapper status %s and message to non-retryable %s failure',
    async (status, message, reason) => {
      const result = await createApi({
        baseUrl: 'https://app.example',
        fetcher: jest.fn().mockResolvedValue(jsonResponse({ error: message }, status)),
      }).download(reelUrl, 'balanced');

      expect(result).toEqual({
        kind: 'failure',
        reason,
        retryable: false,
        message,
        status,
      });
    },
  );

  test('keeps rate limits and server failures retryable provider errors', async () => {
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(
        jsonResponse({ error: 'Too many requests. Please wait.' }, 429),
      ),
    }).download(reelUrl, 'balanced');

    expect(result).toMatchObject({
      kind: 'failure',
      reason: 'provider',
      retryable: true,
      status: 429,
    });
  });

  test('rejects a direct DTO whose file URL is not public HTTP(S)', async () => {
    const result = await createApi({
      baseUrl: 'https://app.example',
      fetcher: jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          platform: 'instagram',
          downloadUrl: 'file:///private/clip.mp4',
          filename: 'clip.mp4',
          type: 'video',
        }),
      ),
    }).download(reelUrl, 'balanced');

    expect(result).toMatchObject({ kind: 'failure', reason: 'malformed' });
  });

  test('rejects obvious private cobalt bases but permits localhost wrapper development', async () => {
    const cobalt = await createApi({
      baseUrl: 'https://cobalt.example',
      fetcher: jest.fn(),
    }).preview(reelUrl);
    const port = await createApi({
      baseUrl: 'http://localhost:9000',
      fetcher: jest.fn(),
    }).preview(reelUrl);

    expect(cobalt).toMatchObject({ kind: 'failure', reason: 'invalid_base' });
    expect(port).toMatchObject({ kind: 'failure', reason: 'invalid_base' });
  });
});
