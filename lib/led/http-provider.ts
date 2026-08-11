import type {
  LedCampaignRelease,
  LedScreenProvider,
  LedStatusResult,
  LedSubmitResult,
} from "./types";

export interface HttpLedProviderConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Initial provider adapter contract.
 *
 * The actual endpoint paths, request signing, payload fields, and status
 * mapping must be updated when the LED operator supplies its API
 * documentation and sandbox credentials.
 */
export class HttpLedScreenProvider implements LedScreenProvider {
  readonly key = "led_provider_api";
  readonly mode = "api" as const;

  constructor(private readonly config: HttpLedProviderConfig) {
    if (!config.baseUrl || !config.apiKey) {
      throw new Error(
        "LED provider API mode requires a base URL and API key.",
      );
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetch(
      new URL(path, this.config.baseUrl),
      {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as T & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error ||
          `LED provider request failed with ${response.status}.`,
      );
    }

    return payload;
  }

  async submitCampaign(
    release: LedCampaignRelease,
  ): Promise<LedSubmitResult> {
    return this.request<LedSubmitResult>("campaigns", {
      method: "POST",
      body: JSON.stringify(release),
    });
  }

  async getCampaignStatus(
    externalReference: string,
  ): Promise<LedStatusResult> {
    return this.request<LedStatusResult>(
      `campaigns/${encodeURIComponent(externalReference)}`,
      { method: "GET" },
    );
  }

  async cancelCampaign(
    externalReference: string,
  ): Promise<LedStatusResult> {
    return this.request<LedStatusResult>(
      `campaigns/${encodeURIComponent(externalReference)}`,
      { method: "DELETE" },
    );
  }
}
