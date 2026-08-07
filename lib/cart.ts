export const CART_STORAGE_KEY = "la-grandiosa-contract-cart-v2";

export interface ContractCartItem {
  id: string;
  sku: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface NewContractCartItem {
  sku: string;
  startDate: string;
  endDate: string;
}

function isContractCartItem(value: unknown): value is ContractCartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ContractCartItem>;

  return (
    typeof item.id === "string" &&
    typeof item.sku === "string" &&
    typeof item.startDate === "string" &&
    typeof item.endDate === "string" &&
    typeof item.createdAt === "string"
  );
}

export function readContractCart(): ContractCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isContractCartItem) : [];
  } catch {
    return [];
  }
}

export function writeContractCart(items: ContractCartItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("la-grandiosa-cart-updated"));
}

export function addContractCartItem(
  input: NewContractCartItem,
): { items: ContractCartItem[]; added: boolean } {
  const current = readContractCart();

  const duplicate = current.some(
    (item) =>
      item.sku === input.sku &&
      item.startDate === input.startDate &&
      item.endDate === input.endDate,
  );

  if (duplicate) {
    return { items: current, added: false };
  }

  const item: ContractCartItem = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };

  const next = [...current, item];
  writeContractCart(next);
  return { items: next, added: true };
}

export function removeContractCartItem(id: string): ContractCartItem[] {
  const next = readContractCart().filter((item) => item.id !== id);
  writeContractCart(next);
  return next;
}

export function clearContractCart(): void {
  writeContractCart([]);
}
