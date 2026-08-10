export type LedReleaseStatus =
  | "pending"
  | "submitted"
  | "acknowledged"
  | "live"
  | "failed"
  | "cancelled";

export interface LedCampaignAsset {
  screenTarget: "left" | "center" | "right";
  signedDownloadUrl: string;
  filename: string;
  mimeType: string;
  durationSeconds?: number;
  widthPixels?: number;
  heightPixels?: number;
}

export interface LedCampaignRelease {
  releaseId: string;
  orderId: string;
  orderNumber: string;
  startDate: string;
  endDate: string;
  assets: LedCampaignAsset[];
  metadata: Record<string, unknown>;
}

export interface LedSubmitResult {
  providerKey: string;
  externalReference: string;
  status: LedReleaseStatus;
  raw?: Record<string, unknown>;
}

export interface LedStatusResult {
  providerKey: string;
  externalReference: string;
  status: LedReleaseStatus;
  message?: string;
  raw?: Record<string, unknown>;
}

export interface LedScreenProvider {
  readonly key: string;
  readonly mode: "manual" | "api";

  submitCampaign(
    release: LedCampaignRelease,
  ): Promise<LedSubmitResult>;

  getCampaignStatus(
    externalReference: string,
  ): Promise<LedStatusResult>;

  cancelCampaign(
    externalReference: string,
  ): Promise<LedStatusResult>;
}
