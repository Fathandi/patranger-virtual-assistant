import pinoModule from 'pino';

function formatErr(err: unknown) {
  if (!err) return undefined;
  const e = err as any;
  const name = e?.name;
  const message = e?.message;
  const stack = e?.stack;

  // mysql2 errors are often nested; keep the essential fields.
  const code = e?.code;
  const errno = e?.errno;
  const syscall = e?.syscall;
  const address = e?.address;
  const port = e?.port;

  return {
    name,
    message,
    stack,
    code,
    errno,
    syscall,
    address,
    port
  };
}

export function createLogger(level: string) {
  // whatsapp-web.js / Node ESM interop: pino typings can be tricky, so cast to callable.
  const pino = pinoModule as unknown as (opts: any) => any;

  return pino({
    level,
    // Make logs much more readable in terminals.

    formatters: {
      level(label: string) {
        return { level: label };
      },
      log(obj: any) {
        // Normalize err for cleaner output.
        if (obj?.err) {
          obj.err = formatErr(obj.err);
        }
        if (typeof obj.err === 'object' && obj.err?.stack) {
          // Keep stack as string (avoid objects/functions).
          obj.err.stack = String(obj.err.stack);
        }
        return obj;
      }
    },
    // Keep logs clean even without pino-pretty installed.
    redact: {
      paths: [
        'req.headers.authorization',
        'request.headers.authorization',
        'authorization',
        'apiKey',
        'SMTP_PASS',
        'MYSQL_PASSWORD',
        'POLLINATIONS_API_KEY',
        'OTP_HASH_SECRET'
      ]
    }
  });
}



