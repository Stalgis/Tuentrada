export const backendFetch = async (
  url: string,
  init: RequestInit = {},
): Promise<Response> => fetch(url, init);
