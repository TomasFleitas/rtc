export const WAIT_TIME = 1 * 60000; // Min

export const ERRORS_CODES = {
  IN_PROGRESS_CONNECTION_ERRO: 1000,
  CURRENT_PEER_IS_REQUIRED: 1001,
  PEER_ID_REQUIRED: 1002,
  SAME_PEER_ERROR: 1003,
  /* 1000...1007 frontend codes */
  RESTRICTION_ERROR: 1008,
  TIMEOUT_ERROR: 1009,
  BAD_REQUEST_ERROR: 1010,
};

export const allowedFileTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/webm',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/xml',
  'text/csv',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
];
