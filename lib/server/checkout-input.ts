import type { ContractCartItem } from "../cart";

export interface ClientInformationInput {
  fullName: string;
  email: string;
  telephone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  companyName: string;
  agencyName: string;
  campaignName: string;
  purchaseOrderNumber: string;
  smsTransactionalConsent: boolean;
}

export interface DraftCheckoutRequest {
  client: ClientInformationInput;
  cartItems: ContractCartItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContractCartItem(value: unknown): value is ContractCartItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sku === "string" &&
    typeof value.startDate === "string" &&
    typeof value.endDate === "string" &&
    typeof value.createdAt === "string"
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseStringField(
  record: Record<string, unknown>,
  field: string,
  required = true,
): string {
  const value = record[field];

  if (typeof value !== "string") {
    if (required) {
      throw new Error(`Missing or invalid field: ${field}`);
    }

    return "";
  }

  return value.trim();
}

function parseBooleanField(
  record: Record<string, unknown>,
  field: string,
): boolean {
  const value = record[field];

  return value === true || value === "true" || value === "1";
}

export function parseDraftCheckoutRequest(
  value: unknown,
): DraftCheckoutRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid checkout payload.");
  }

  const clientRecord = value.client;
  const cartItemsRecord = value.cartItems;

  if (!isRecord(clientRecord)) {
    throw new Error("Missing client information.");
  }

  if (!Array.isArray(cartItemsRecord) || cartItemsRecord.length === 0) {
    throw new Error("The checkout cart must contain at least one item.");
  }

  const cartItems = cartItemsRecord.map((item) => {
    if (!isContractCartItem(item)) {
      throw new Error("Invalid cart item format.");
    }

    return item;
  });

  const client: ClientInformationInput = {
    fullName: parseStringField(clientRecord, "fullName"),
    email: parseStringField(clientRecord, "email"),
    telephone: parseStringField(clientRecord, "telephone"),
    addressLine1: parseStringField(clientRecord, "addressLine1"),
    addressLine2: parseStringField(clientRecord, "addressLine2", false),
    city: parseStringField(clientRecord, "city"),
    region: parseStringField(clientRecord, "region"),
    postalCode: parseStringField(clientRecord, "postalCode"),
    country: parseStringField(clientRecord, "country"),
    companyName: parseStringField(clientRecord, "companyName", false),
    agencyName: parseStringField(clientRecord, "agencyName", false),
    campaignName: parseStringField(clientRecord, "campaignName", false),
    purchaseOrderNumber: parseStringField(
      clientRecord,
      "purchaseOrderNumber",
      false,
    ),
    smsTransactionalConsent: parseBooleanField(
      clientRecord,
      "smsTransactionalConsent",
    ),
  };

  if (!client.fullName) {
    throw new Error("Enter the purchaser's full name.");
  }

  if (!isValidEmail(client.email)) {
    throw new Error("Enter a valid email address.");
  }

  if (!client.telephone) {
    throw new Error("Enter a valid telephone number.");
  }

  if (!client.addressLine1) {
    throw new Error("Enter the first address line.");
  }

  if (!client.city) {
    throw new Error("Enter a city.");
  }

  if (!client.region) {
    throw new Error("Enter a region or state.");
  }

  if (!client.postalCode) {
    throw new Error("Enter a postal code.");
  }

  if (!client.country) {
    throw new Error("Enter a country.");
  }

  return { client, cartItems };
}
