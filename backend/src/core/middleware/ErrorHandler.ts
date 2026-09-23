import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { message: 'Route not found.' } });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  response.status(safeStatus).json({
    error: { message: safeStatus === 500 ? 'Internal server error.' : 'Request failed.' },
  });
};
