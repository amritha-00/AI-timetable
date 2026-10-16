import type { Tenant } from "@/types"
import { apiClient } from "./client"

/** Exactly one of these comes back. `checkoutUrl` means Stripe is live -
 * redirect the browser there. `tenant` means the backend has no Stripe
 * account configured and used the mock fallback, flipping the plan
 * immediately (same as the old demo "Upgrade now" button). */
export interface CheckoutResult {
  checkoutUrl: string | null
  tenant: Tenant | null
}

export const billingApi = {
  /** Starts (or, in mock mode, completes) an upgrade. */
  checkout: async (): Promise<CheckoutResult> => {
    const { data } = await apiClient.post<{ checkout_url: string | null; tenant: Tenant | null }>("/billing/checkout")
    return { checkoutUrl: data.checkout_url, tenant: data.tenant }
  },
  /** Stripe's hosted page for managing/cancelling - only available once
   * real Stripe billing is configured on the backend. */
  portal: async (): Promise<string> => {
    const { data } = await apiClient.post<{ portal_url: string }>("/billing/portal")
    return data.portal_url
  },
}
