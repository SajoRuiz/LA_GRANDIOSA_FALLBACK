import { getCommerceServerConfig } from "@/lib/server/config";
import { HttpLedScreenProvider } from "./http-provider";
import { ManualLedScreenProvider } from "./manual-provider";
import type { LedScreenProvider } from "./types";

export function getLedScreenProvider(): LedScreenProvider {
  const config = getCommerceServerConfig();

  if (config.ledProviderMode === "api") {
    return new HttpLedScreenProvider({
      baseUrl: config.ledProviderApiBaseUrl,
      appKey: config.ledProviderApiKey,
      appSecret: config.ledProviderApiSecret,
      playerIds: config.ledProviderPlayerIds,
      statusPath: config.ledProviderStatusPath,
      logsPath: config.ledProviderLogsPath,
      subscribePath: config.ledProviderSubscribePath,
    });
  }

  return new ManualLedScreenProvider();
}
