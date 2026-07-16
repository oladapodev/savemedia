import type { MediaType } from '../downloads/types';

export type ApiFailureReason =
  | 'invalid_base'
  | 'network'
  | 'unsupported'
  | 'private'
  | 'not_found'
  | 'provider'
  | 'malformed';

export type ApiFailure = {
  kind: 'failure';
  reason: ApiFailureReason;
  retryable: boolean;
  message: string;
  status?: number;
};

export type PreviewSuccess = {
  kind: 'preview';
  platform: string;
  url: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  mediaType?: MediaType;
};

export type PreviewResult = PreviewSuccess | ApiFailure;

export type DirectDownload = {
  kind: 'direct';
  platform: string;
  downloadUrl: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
};

export type PickerDownloadItem = {
  id: string;
  downloadUrl: string;
  mediaType: MediaType;
  filename: string;
  mimeType: string;
};

export type PickerDownload = {
  kind: 'picker';
  platform: string;
  items: readonly PickerDownloadItem[];
};

export type DownloadResult = DirectDownload | PickerDownload | ApiFailure;

export interface MediaApi {
  preview(url: string): Promise<PreviewResult>;
  download(
    url: string,
    quality: 'balanced' | 'original' | 'audio' | '720' | '1080',
  ): Promise<DownloadResult>;
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
