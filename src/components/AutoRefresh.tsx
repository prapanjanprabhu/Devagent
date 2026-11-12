"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server data every few seconds so live numbers (uptime) keep moving. */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), seconds * 1000); return () => clearInterval(t); }, [router, seconds]);
  return null;
}
