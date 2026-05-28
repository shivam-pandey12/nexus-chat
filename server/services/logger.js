import crypto from 'node:crypto';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEY_PATTERN =
  /(authorization|token|secret|private[_-]?key|admin[_-]?key|webhook|signature|service[_-]?account|razorpay|firebase|rawPayload|raw_event|payload)/i;
const SECRET_VALUE_PATTERN =
  /(-----BEGIN PRIVATE KEY-----|AIza[0-9A-Za-z_-]+|rzp_(test|live)_[0-9A-Za-z]+|Bearer\s+[0-9A-Za-z._-]+)/i;

export function createLogger({ level = process.env.LOG_LEVEL || 'info', maxRecentErrors = 80 } = {}) {
  const activeLevel = LEVELS[String(level).toLowerCase()] ?? LEVELS.info;
  const recentErrors = [];

  function write(logLevel, message, context = {}) {
    if ((LEVELS[logLevel] ?? LEVELS.info) < activeLevel) {
      return;
    }

    const safeContext = redact(context);
    const entry = {
      time: new Date().toISOString(),
      level: logLevel,
      message: String(message || ''),
      ...(Object.keys(safeContext).length ? { context: safeContext } : {}),
    };

    const line = JSON.stringify(entry);

    if (logLevel === 'error') {
      console.error(line);
      recentErrors.unshift(entry);
      recentErrors.splice(maxRecentErrors);
      return;
    }

    if (logLevel === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }

  return {
    debug(message, context) {
      write('debug', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    error(message, context) {
      write('error', message, normalizeErrorContext(context));
    },
    redact,
    getRecentErrors(limit = 50) {
      return recentErrors.slice(0, Math.max(1, Math.min(Number(limit) || 50, maxRecentErrors)));
    },
    requestIdMiddleware() {
      return (request, response, next) => {
        const requestId = String(request.get('x-request-id') || crypto.randomUUID());
        request.requestId = requestId;
        response.setHeader('x-request-id', requestId);
        next();
      };
    },
    errorHandler() {
      return (error, request, response, _next) => {
        write('error', 'Unhandled request error', {
          requestId: request?.requestId,
          method: request?.method,
          path: request?.path,
          error,
        });
        response.status(500).json({ error: 'Something went wrong. Please try again.', requestId: request?.requestId });
      };
    },
  };
}

export function redact(value, depth = 0) {
  if (depth > 5) {
    return '[redacted-depth]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: process.env.NODE_ENV === 'development' ? redactString(value.stack || '') : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [key, SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redact(item, depth + 1)]),
    );
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  return value;
}

function redactString(value) {
  if (!value) {
    return value;
  }

  return String(value)
    .replace(SECRET_VALUE_PATTERN, '[redacted]')
    .replace(/(client_email["']?\s*:\s*["'])[^"']+/gi, '$1[redacted]')
    .replace(/(private_key["']?\s*:\s*["'])[^"']+/gi, '$1[redacted]');
}

function normalizeErrorContext(context = {}) {
  if (context instanceof Error) {
    return { error: context };
  }

  return context || {};
}
