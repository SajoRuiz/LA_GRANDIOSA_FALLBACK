import type {
  LedCampaignRelease,
  LedScreenProvider,
  LedStatusResult,
  LedSubmitResult,
  LedVerifyInput,
  LedWebhookSubscriptionResult,
} from "./types";

export class ManualLedScreenProvider implements LedScreenProvider {
  readonly key = "manual_release";
  readonly mode = "manual" as const;

  async submitCampaign(
    release: LedCampaignRelease,
  ): Promise<LedSubmitResult> {
    return {
      providerKey: this.key,
      externalReference: release.releaseId,
      status: "pending",
      raw: {
        message:
          "Manual release remains required until the LED provider API is confirmed.",
      },
    };
  }

  async getCampaignStatus(
    externalReference: string,
  ): Promise<LedStatusResult> {
    return {
      providerKey: this.key,
      externalReference,
      status: "pending",
      message: "Status is maintained manually.",
    };
  }

  async cancelCampaign(
    externalReference: string,
  ): Promise<LedStatusResult> {
    return {
      providerKey: this.key,
      externalReference,
      status: "cancelled",
      message: "Manual release cancelled.",
    };
  }

  async verifyCampaignStatus(
    input: LedVerifyInput,
  ): Promise<LedStatusResult> {
    return {
      providerKey: this.key,
      externalReference: input.externalReference,
      status: "pending",
      message: "Manual provider does not support signed verification pulls.",
    };
  }

  async subscribeSolutionChangeNotifications(
    callbackUrl: string,
  ): Promise<LedWebhookSubscriptionResult> {
    return {
      providerKey: this.key,
      subscribed: false,
      callbackUrl,
      raw: {
        message: "Manual provider does not support webhook subscriptions.",
      },
    };
  }
}
