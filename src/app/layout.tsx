import "./globals.css";
import type { Metadata, Viewport } from "next";
import ToastHost from "@/components/ToastHost";

export const metadata: Metadata = {
  title: { default: "Devagent - AI front desk for appointment businesses", template: "%s · Devagent" },
  description: "Devagent answers customers on WhatsApp and the web, books your calendar, takes deposits and sends reminders.",
};
export const viewport: Viewport = { themeColor: "#0A0F1F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#content" style={{ position: "absolute", left: -999 }} className="btn">Skip to content</a>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
