const MAX_BODY_BYTES = 16 * 1024;

export class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export const readJson = (request, signal) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  const cleanup = () => {
    request.off("data", onData);
    request.off("end", onEnd);
    request.off("error", onError);
    signal.removeEventListener("abort", onAbort);
  };
  const fail = (error) => {
    cleanup();
    request.pause();
    reject(error);
  };
  const onError = (error) => fail(error);
  const onAbort = () => fail(signal.reason);
  const onData = (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      fail(new RequestValidationError("El body supera el límite permitido."));
      return;
    }
    chunks.push(chunk);
  };
  const onEnd = () => {
    cleanup();
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      reject(new RequestValidationError("El body debe contener JSON válido."));
    }
  };
  if (signal.aborted) return onAbort();
  signal.addEventListener("abort", onAbort, { once: true });
  request.on("data", onData);
  request.once("end", onEnd);
  request.once("error", onError);
});
