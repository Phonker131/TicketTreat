import { Suspense } from "react";
import { TicketClient } from "@/components/TicketClient";

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="state-card">Loading ticket…</div>}>
      <TicketClient />
    </Suspense>
  );
}
