let requestSequence = 0;

export const backendFetch = async (
  url: string,
  init: RequestInit = {},
): Promise<Response> => {
  const id = ++requestSequence;
  const method = init.method ?? "GET";
  const startedAt = Date.now();
  const startedISO = new Date(startedAt).toISOString();

  console.log(`[API #${id} START] ${startedISO} ${method} ${url}`);

  try {
    const response = await fetch(url, init);
    const durationMs = Date.now() - startedAt;
    console.log(
      `[API #${id} END] ${new Date().toISOString()} ${response.status} ${durationMs}ms ${method} ${url}`,
    );
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.log(
      `[API #${id} ERROR] ${new Date().toISOString()} ${errorName} ${durationMs}ms ${method} ${url}`,
    );
    throw error;
  }
};
