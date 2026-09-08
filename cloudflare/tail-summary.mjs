const decoder = new TextDecoder();
let buffer = '';

function emitSummary(event) {
  const request = event?.event?.request;
  if (!request?.url) return;

  let pathname = request.url;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    // Keep the original value when Wrangler reports a non-standard URL.
  }

  process.stdout.write(`${JSON.stringify({
    pathname,
    method: request.method,
    status: event?.event?.response?.status,
    outcome: event?.outcome,
    cpuMs: event?.cpuTime,
    wallMs: event?.wallTime,
  })}\n`);
}

function consumeObjects() {
  while (buffer.length) {
    const start = buffer.indexOf('{');
    if (start < 0) {
      buffer = '';
      return;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < buffer.length; index += 1) {
      const character = buffer[index];

      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          const serialized = buffer.slice(start, index + 1);
          buffer = buffer.slice(index + 1);
          try {
            emitSummary(JSON.parse(serialized));
          } catch (error) {
            process.stderr.write(`Evento ignorado: ${error.message}\n`);
          }
          break;
        }
      }

      if (index === buffer.length - 1) return;
    }
  }
}

process.stdin.on('data', chunk => {
  buffer += decoder.decode(chunk, { stream: true });
  consumeObjects();
});

process.stdin.on('end', () => {
  buffer += decoder.decode();
  consumeObjects();
});
