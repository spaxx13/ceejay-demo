import { NextResponse } from "next/server";
import { getLookups, getDeviceModels, getRequestFormContent, getCustomFormFields, getBranches } from "@/lib/db";
import { OTP_GATE_ENABLED, PICKUP_DELIVERY_MOBILE_ENABLED, PICKUP_DELIVERY_PUBLIC_ENABLED } from "@/lib/config";
import { emailConfigured } from "@/lib/email";
import {
  PROVINCE_FEES,
  SUNDAY_ONLY_PROVINCES,
  DOWNPAYMENT_PROVINCES,
  EXCLUDED_FROM_HOME_SERVICE,
  EXCLUDED_FROM_PICKUP_DELIVERY,
  PICKUP_DELIVERY_FEE_TIERS,
  PICKUP_DELIVERY_FEE_MIN_PESOS,
  PICKUP_DELIVERY_ROAD_FACTOR,
  PICKUP_DELIVERY_COVERAGE,
  PICKUP_DELIVERY_COVERAGE_LABEL,
  PICKUP_DELIVERY_COVERAGE_POLYGON,
  PICKUP_DELIVERY_SEARCH_BOUNDS,
  PICKUP_DELIVERY_FEE_MAX_PESOS,
  PICKUP_DELIVERY_FEE_TIER_LABEL,
} from "@/lib/homeServiceFees";
import { PICKUP_DELIVERY_AGREEMENT_TERMS, PICKUP_DELIVERY_AGREEMENT_VERSION } from "@/lib/pickupDeliveryAgreement";

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
      // Public fields only — the per-branch Pickup & Delivery share is an
      // internal routing setting and never leaves the admin side.
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        contactNumber: b.contactNumber,
        homeServiceQueue: b.homeServiceQueue,
        active: b.active,
        lat: b.lat,
        lng: b.lng,
      })),
      businessRules: {
        provinceFees: PROVINCE_FEES,
        sundayOnlyProvinces: [...SUNDAY_ONLY_PROVINCES],
        downpaymentProvinces: [...DOWNPAYMENT_PROVINCES],
        excludedFromHomeService: [...EXCLUDED_FROM_HOME_SERVICE],
        // Service types the Pickup & Delivery form must leave out of its
        // dropdown (the server rejects them on submit too).
        excludedFromPickupDelivery: [...EXCLUDED_FROM_PICKUP_DELIVERY],
        // Distance-tiered (lib/homeServiceFees.ts pickupDeliveryQuote):
        // straight-line km from the pickup pin to the nearest pinned branch
        // × roadFactor, then the first tier whose maxKm covers it (null =
        // no cap). pickupDeliveryFeePesos is kept as the base tier for
        // app builds that still read the old flat value.
        pickupDeliveryFeeTiers: PICKUP_DELIVERY_FEE_TIERS,
        pickupDeliveryRoadFactor: PICKUP_DELIVERY_ROAD_FACTOR,
        pickupDeliveryFeePesos: PICKUP_DELIVERY_FEE_MIN_PESOS,
        // Where Pickup & Delivery can be booked: provinces (keys/labels as
        // in the near-area address dataset) and, when `cities` is set, only
        // those cities/municipalities within it (null = whole province).
        pickupDeliveryCoverage: PICKUP_DELIVERY_COVERAGE,
        pickupDeliveryCoverageLabel: PICKUP_DELIVERY_COVERAGE_LABEL,
        // The pin itself must land inside this outline (pointInPickupDeliveryCoverage),
        // and the address search is limited to its bounding box — same checks
        // the web form runs before submit.
        pickupDeliveryCoveragePolygon: PICKUP_DELIVERY_COVERAGE_POLYGON,
        pickupDeliverySearchBounds: PICKUP_DELIVERY_SEARCH_BOUNDS,
        pickupDeliveryFeeMinPesos: PICKUP_DELIVERY_FEE_MIN_PESOS,
        pickupDeliveryFeeMaxPesos: PICKUP_DELIVERY_FEE_MAX_PESOS,
        pickupDeliveryFeeTierLabel: PICKUP_DELIVERY_FEE_TIER_LABEL,
        // The Pickup & Delivery Agreement shown above the submit button; the
        // app sends pickupDeliveryAgreed: "1" once it's accepted.
        pickupDeliveryAgreementTerms: PICKUP_DELIVERY_AGREEMENT_TERMS,
        pickupDeliveryAgreementVersion: PICKUP_DELIVERY_AGREEMENT_VERSION,
      },
      flags: {
        // The app's own switch — on for the app alone via
        // PICKUP_DELIVERY_MOBILE_ENABLED, or everywhere via the public flag.
        pickupDeliveryPublicEnabled: PICKUP_DELIVERY_PUBLIC_ENABLED || PICKUP_DELIVERY_MOBILE_ENABLED,
        otpGateEnabled: OTP_GATE_ENABLED,
        // Walk-in pre-registration verifies by email, and only when email
        // sending is really configured — same gate WalkInForm.tsx applies.
        walkInEmailOtpEnabled: OTP_GATE_ENABLED && emailConfigured(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
