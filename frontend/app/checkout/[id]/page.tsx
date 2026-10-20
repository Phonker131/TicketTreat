import { Suspense } from "react";
import { CheckoutClient } from "@/components/CheckoutClient";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="state-card">Loading checkout…</div>}>
      <CheckoutClient />
    </Suspense>
  );
}
