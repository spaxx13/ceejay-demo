import { NextResponse } from "next/server";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields, getBranches } from "@/lib/db";
import { OTP_GATE_ENABLED, PICKUP_DELIVERY_PUBLIC_ENABLED } from "@/lib/config";
import {
  PROVINCE_FEES,
  SUNDAY_ONLY_PROVINCES,
  DOWNPAYMENT_PROVINCES,
  EXCLUDED_FROM_HOME_SERVICE,
  PICKUP_DELIVERY_FEE_PESOS,
} from "@/lib/homeServiceFees";

// One bundle the native app fetches on launch (and can refresh) to render
// the Home Service / Pickup & Delivery forms without hardcoding business
// rules that could silently drift from the server — the actual submit
// endpoint remains the real authority regardless of what this shows.
export async function GET() {
  const [lookups, deviceModels, formContent, customFields, branches] = await Promise.all([
    getLookups(),
    getDeviceModels(),
    getRequestFormContent(),
    getCustomFormFields(),
    getBranches(),
  ]);

  return NextResponse.json(
    {
      lookups,
      deviceModels,
      formContent,
      customFields,
      branches,
      businessRules: {
        provinceFees: PROVINCE_FEES,
        sundayOnlyProvinces: [...SUNDAY_ONLY_PROVINCES],
        downpaymentProvinces: [...DOWNPAYMENT_PROVINCES],
        excludedFromHomeService: [...EXCLUDED_FROM_HOME_SERVICE],
        pickupDeliveryFeePesos: PICKUP_DELIVERY_FEE_PESOS,
      },
      flags: {
        pickupDeliveryPublicEnabled: PICKUP_DELIVERY_PUBLIC_ENABLED,
        otpGateEnabled: OTP_GATE_ENABLED,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
