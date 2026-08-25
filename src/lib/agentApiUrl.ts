type AgentApiUrlOptions = {
  configuredUrl?: string;
  isDev: boolean;
  platform: string;
};

export const resolveAgentApiUrl = ({
  configuredUrl,
  isDev,
  platform,
}: AgentApiUrlOptions): string | null => {
  if (configuredUrl) return configuredUrl;
  if (!isDev) return null;

  if (platform === "android") return "http://10.0.2.2:8787";
  return "http://127.0.0.1:8787";
};
