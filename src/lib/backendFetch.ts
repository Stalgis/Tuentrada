let requestSequence = 0;

const idsCountLabel = (body: BodyInit | null | undefined): string => {
  if (typeof body !== "string") return "";
  try {
    const parsed = JSON.parse(body) as { ids?: unknown };
    return Array.isArray(parsed.ids) ? ` ids=${parsed.ids.length}` : "";
  } catch {
    return "";
  }
};

export const backendFetch = async (
  url: string,
  init: RequestInit = {},
): Promise<Response> => {
  if (!__DEV__) {
    return fetch(url, init);
  }

  const id = ++requestSequence;
  const method = init.method ?? "GET";
  const startedAt = Date.now();
  const requestLabel = `${method} ${url}${idsCountLabel(init.body)}`;

  console.log(`[API #${id} START] ${new Date(startedAt).toISOString()} ${requestLabel}`);

  try {
    const response = await fetch(url, init);
    console.log(
      `[API #${id} END] ${response.status} ${Date.now() - startedAt}ms ${requestLabel}`,
    );
    return response;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.log(
      `[API #${id} ERROR] ${errorName} ${Date.now() - startedAt}ms ${requestLabel}`,
    );
    throw error;
  }
};
