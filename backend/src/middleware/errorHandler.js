export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  
  let errorCode = 'INTERNAL_SERVER_ERROR';
  if (statusCode === 400) errorCode = 'BAD_REQUEST';
  else if (statusCode === 401) errorCode = 'UNAUTHORIZED';
  else if (statusCode === 403) errorCode = 'FORBIDDEN';
  else if (statusCode === 404) errorCode = 'NOT_FOUND';
  else if (statusCode === 409) errorCode = 'CONFLICT';

  const response = {
    success: false,
    error: {
      code: err.code || errorCode,
      message: err.message || 'Internal server error.'
    }
  };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    console.error(`[Error ${statusCode}]:`, err);
  }

  res.status(statusCode).json(response);
};
