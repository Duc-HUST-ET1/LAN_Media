import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { message: 'Route not found.' } });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const isApiError = typeof error === 'object' && error !== null && 'statusCode' in error;
  const isDatabaseUnavailable = typeof error === 'object' && error !== null
    && 'code' in error && typeof error.code === 'string'
    && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_TABLEACCESS_DENIED_ERROR'].includes(error.code);
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : 500;
  const apiStatus = isApiError && typeof error.statusCode === 'number' ? error.statusCode : status;
  const safeStatus = isDatabaseUnavailable ? 503 : apiStatus >= 400 && apiStatus < 600 ? apiStatus : 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(error instanceof Error ? error.message : 'Unexpected request error.');
  }

  response.status(safeStatus).json({
    error: { message: safeStatus === 500 ? 'Internal server error.' : safeStatus === 503 ? 'Database is unavailable.' : error instanceof Error ? error.message : 'Request failed.' },
  });
};
