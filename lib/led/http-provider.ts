import { createHash, randomBytes } from "node:crypto";

import type {
  LedCampaignRelease,
  LedScreenProvider,
  LedStatusResult,
  LedSubmitResult,
  LedVerifyInput,
  LedWebhookSubscriptionResult,
} from "./types";

export interface HttpLedProviderConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  playerIds: string[];
  statusPath: string;
  logsPath: string;
  subscribePath: string;
}

export class HttpLedScreenProvider implements LedScreenProvider {
  readonly key = "led_provider_api";
  readonly mode = "api" as const;
  private readonly simulatorMode: boolean;

  constructor(private readonly config: HttpLedProviderConfig) {
    if (!config.baseUrl || !config.appKey || !config.appSecret) {
      throw new Error(
        "LED provider API mode requires base URL, app key, and app secret.",
      );
    }

    this.simulatorMode =
      /\/simulated-provider\/?$/i.test(config.baseUrl) ||
      /\/simulated-provider\//i.test(config.baseUrl);
  }

  private nonce(): string {
    return randomBytes(8).toString("hex");
  }

  private curTime(): string {
    return String(Math.floor(Date.now() / 1000));
  }

  private checksum(nonce: string, curTime: string): string {
    return createHash("sha256")
      .update(`${this.config.appSecret}${nonce}${curTime}`)
      .digest("hex");
  }

  private buildUrl(path: string): URL {
    if (/^https?:\/\//i.test(path)) {
      return new URL(path);
    }

    const sanitized = path.replace(/^\/+/, "");
    const base = this.config.baseUrl.endsWith("/")
      ? this.config.baseUrl
      : `${this.config.baseUrl}/`;
    return new URL(sanitized, base);
  }

  private mapProviderStatus(value: string): LedStatusResult["status"] {
    const normalized = value.trim().toLowerCase();
    switch (normalized) {
      case "submitted":
      case "sending":
      case "distributing":
        return "submitted";
      case "ack":
      case "acknowledged":
        return "acknowledged";
      case "released":
      case "active":
      case "playing":
        return "released";
      case "live":
        return "live";
      case "cancelled":
      case "canceled":
        return "cancelled";
      case "failed":
      case "error":
        return "failed";
      default:
        return "pending";
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const nonce = this.nonce();
    const curTime = this.curTime();
    const checkSum = this.checksum(nonce, curTime);

    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Keep simulator compatibility while also sending NovaCloud auth headers.
        Authorization: `Bearer ${this.config.appKey}`,
        AppKey: this.config.appKey,
        Nonce: nonce,
        CurTime: curTime,
        CheckSum: checkSum,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as T & {
      error?: string;
      code?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error ||
          payload.code ||
          `LED provider request failed with ${response.status}.`,
      );
    }

    return payload;
  }

  private async requestWithRetry<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const delays = [0, 2000, 8000, 30000];
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt] > 0) {
        await this.sleep(delays[attempt]);
      }

      try {
        return await this.request<T>(path, init);
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        lastError = error;
        const retryable = /429|5\d\d/.test(error.message);
        if (!retryable || attempt === delays.length - 1) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("LED provider request failed.");
  }

  private toPublishPayload(
    release: LedCampaignRelease,
  ): Record<string, unknown> {
    const playerIds =
      this.config.playerIds.length > 0
        ? this.config.playerIds
        : [release.releaseId];

    const widgets = release.assets.map((asset, index) => ({
      zIndex: index + 1,
      type: asset.mimeType.startsWith("video/") ? "VIDEO" : "PICTURE",
      duration: Math.max(1, Number(asset.durationSeconds ?? 15)) * 1000,
      url: asset.signedDownloadUrl,
      layout: { x: "0%", y: "0%", width: "100%", height: "100%" },
    }));

    return {
      playerIds,
      schedule: {
        startDate: release.startDate,
        endDate: release.endDate,
        plans: [
          {
            weekDays: [0, 1, 2, 3, 4, 5, 6],
            startTime: "00:00:00",
            endTime: "23:59:59",
          },
        ],
      },
      pages: [
        {
          name: `release-${release.releaseId}`,
          repeatCount: 1,
          widgets,
        },
      ],
    };
  }

  private getSuccessReference(
    releaseId: string,
    payload: Record<string, unknown>,
  ): string {
    const success = Array.isArray(payload.success) ? payload.success : [];
    const first = success.find((entry) => typeof entry === "string");
    if (typeof first === "string" && first.trim()) {
      return first;
    }

    return `release-${releaseId}`;
  }

  private async requestPlayerStatus(
    externalReference: string,
    playerIds?: string[],
  ): Promise<Record<string, unknown>> {
    const query = new URLSearchParams();
    query.set("externalReference", externalReference);
    for (const playerId of playerIds ?? this.config.playerIds) {
      query.append("playerIds", playerId);
    }

    return this.requestWithRetry<Record<string, unknown>>(
      `${this.config.statusPath}?${query.toString()}`,
      { method: "GET" },
    );
  }

  private deriveStatusFromPayload(
    payload: Record<string, unknown>,
  ): LedStatusResult["status"] {
    const statusSources = [
      payload.status,
      payload.playerStatus,
      payload.solutionStatus,
      payload.currentStatus,
    ];

    for (const source of statusSources) {
      if (typeof source === "string") {
        return this.mapProviderStatus(source);
      }
    }

    const details = Array.isArray(payload.players)
      ? payload.players
      : Array.isArray(payload.data)
        ? payload.data
        : [];
    for (const item of details) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).status === "string"
      ) {
        return this.mapProviderStatus(
          String((item as Record<string, unknown>).status),
        );
      }
    }

    return "pending";
  }

  async submitCampaign(
    release: LedCampaignRelease,
  ): Promise<LedSubmitResult> {
    if (this.simulatorMode) {
      const simulated = await this.requestWithRetry<LedSubmitResult>(
        "campaigns",
        {
          method: "POST",
          body: JSON.stringify(release),
        },
      );
      return {
        ...simulated,
        providerKey: simulated.providerKey || this.key,
      };
    }

    const payload = this.toPublishPayload(release);
    const raw = await this.requestWithRetry<Record<string, unknown>>(
      "v2/player/program/normal",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    const failed = Array.isArray(raw.fail) ? raw.fail : [];
    const success = Array.isArray(raw.success) ? raw.success : [];
    const status: LedSubmitResult["status"] =
      failed.length > 0 || success.length === 0 ? "failed" : "submitted";

    return {
      providerKey: this.key,
      externalReference: this.getSuccessReference(release.releaseId, raw),
      status,
      raw,
    };
  }

  async getCampaignStatus(
    externalReference: string,
  ): Promise<LedStatusResult> {
    if (this.simulatorMode) {
      const simulated = await this.requestWithRetry<LedStatusResult>(
        `campaigns/${encodeURIComponent(externalReference)}`,
        { method: "GET" },
      );
      return {
        ...simulated,
        providerKey: simulated.providerKey || this.key,
      };
    }

    const raw = await this.requestPlayerStatus(externalReference);

    return {
      providerKey: this.key,
      externalReference,
      status: this.deriveStatusFromPayload(raw),
      raw,
    };
  }

  async verifyCampaignStatus(
    input: LedVerifyInput,
  ): Promise<LedStatusResult> {
    if (this.simulatorMode) {
      return this.getCampaignStatus(input.externalReference);
    }

    const [statusRaw, logsRaw] = await Promise.all([
      this.requestPlayerStatus(input.externalReference, input.playerIds),
      this.requestWithRetry<Record<string, unknown>>(
        `${this.config.logsPath}?${new URLSearchParams({ externalReference: input.externalReference }).toString()}`,
        { method: "GET" },
      ).catch(() => ({} as Record<string, unknown>)),
    ]);

    const status = this.deriveStatusFromPayload({
      ...statusRaw,
      logs: logsRaw,
    });

    return {
      providerKey: this.key,
      externalReference: input.externalReference,
      status,
      raw: {
        status: statusRaw,
        logs: logsRaw,
      },
    };
  }

  async cancelCampaign(
    externalReference: string,
  ): Promise<LedStatusResult> {
    if (this.simulatorMode) {
      const simulated = await this.requestWithRetry<LedStatusResult>(
        `campaigns/${encodeURIComponent(externalReference)}`,
        { method: "DELETE" },
      );
      return {
        ...simulated,
        providerKey: simulated.providerKey || this.key,
      };
    }

    const raw = await this.requestWithRetry<Record<string, unknown>>(
      "v2/player/program/emergency/cancel",
      {
        method: "POST",
        body: JSON.stringify({ externalReference }),
      },
    );

    return {
      providerKey: this.key,
      externalReference,
      status: "cancelled",
      raw,
    };
  }

  async subscribeSolutionChangeNotifications(
    callbackUrl: string,
  ): Promise<LedWebhookSubscriptionResult> {
    if (this.simulatorMode) {
      return {
        providerKey: this.key,
        subscribed: true,
        callbackUrl,
        raw: {
          simulated: true,
        },
      };
    }

    const raw = await this.requestWithRetry<Record<string, unknown>>(
      this.config.subscribePath,
      {
        method: "POST",
        body: JSON.stringify({
          callbackUrl,
          eventType: "solution_change",
        }),
      },
    );

    return {
      providerKey: this.key,
      subscribed: true,
      callbackUrl,
      raw,
    };
  }
}
