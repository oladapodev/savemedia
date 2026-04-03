export const iMediaSaveOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'iMediaSave Public API',
    version: '1.0.0',
    description:
      'iMediaSave exposes a branded wrapper API for previewing social media content, generating download links, and proxying file downloads.',
  },
  servers: [
    {
      url: '/',
      description: 'Current iMediaSave deployment',
    },
  ],
  tags: [
    {
      name: 'Downloads',
      description: 'Preview links and resolve download URLs for supported public media.',
    },
  ],
  paths: {
    '/api/preview': {
      post: {
        tags: ['Downloads'],
        summary: 'Preview a supported public post or video',
        description:
          'Returns best-effort metadata used by the iMediaSave web interface before a download is requested.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: {
                    type: 'string',
                    format: 'uri',
                    description: 'A supported public social media URL.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Preview metadata.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'platform', 'url'],
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    platform: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    title: { type: ['string', 'null'] },
                    author: { type: ['string', 'null'] },
                    authorUrl: { type: ['string', 'null'], format: 'uri' },
                    thumbnail: { type: ['string', 'null'], format: 'uri' },
                    description: { type: ['string', 'null'] },
                    type: { type: ['string', 'null'] },
                    providerName: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          '400': {
            description: 'The URL is invalid or unsupported.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'The preview service failed unexpectedly.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/download': {
      post: {
        tags: ['Downloads'],
        summary: 'Resolve an iMediaSave download result',
        description:
          'Turns a supported public URL into either a single download link or a multi-item picker response.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: {
                    type: 'string',
                    format: 'uri',
                    description: 'A supported public social media URL.',
                  },
                  quality: {
                    type: 'string',
                    enum: ['2160', '1080', '720', '480', '360', 'audio'],
                    default: '1080',
                    description: 'Preferred video resolution or audio-only mode.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'A single-file download or a multi-item picker result.',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/SingleDownloadResponse',
                    },
                    {
                      $ref: '#/components/schemas/MultiDownloadResponse',
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'The input URL is missing, invalid, or unsupported.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '422': {
            description: 'The media cannot be downloaded as requested.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '502': {
            description: 'The internal download processor failed or is unavailable.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'Unexpected server-side failure.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/proxy-download': {
      get: {
        tags: ['Downloads'],
        summary: 'Stream a file as an attachment',
        description:
          'Proxies a resolved media URL and returns it as a browser download attachment.',
        parameters: [
          {
            in: 'query',
            name: 'url',
            required: true,
            schema: {
              type: 'string',
              format: 'uri',
            },
          },
          {
            in: 'query',
            name: 'filename',
            required: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The file is streamed successfully.',
            content: {
              'application/octet-stream': {},
            },
          },
          '206': {
            description: 'Partial content for resumed downloads.',
            content: {
              'application/octet-stream': {},
            },
          },
          '400': {
            description: 'Missing or invalid query parameters.',
          },
          '500': {
            description: 'Unexpected proxy failure.',
          },
          '502': {
            description: 'The upstream media server returned an invalid response.',
          },
          '504': {
            description: 'The upstream media server timed out.',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
          },
          platform: {
            type: 'string',
          },
          hint: {
            type: 'string',
          },
        },
      },
      DownloadItem: {
        type: 'object',
        required: ['url', 'type', 'filename'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
          },
          thumb: {
            type: 'string',
            format: 'uri',
          },
          type: {
            type: 'string',
          },
          filename: {
            type: 'string',
          },
        },
      },
      SingleDownloadResponse: {
        type: 'object',
        required: ['success', 'platform', 'downloadUrl', 'filename', 'type'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          platform: { type: 'string' },
          downloadUrl: { type: 'string', format: 'uri' },
          filename: { type: 'string' },
          type: { type: 'string' },
        },
      },
      MultiDownloadResponse: {
        type: 'object',
        required: ['success', 'platform', 'multiple', 'items'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          platform: { type: 'string' },
          multiple: { type: 'boolean', enum: [true] },
          audio: { type: 'string', format: 'uri' },
          audioFilename: { type: 'string' },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DownloadItem',
            },
          },
        },
      },
    },
  },
} as const
