import type { Metadata } from "next";
import PlatformLoginForm from "./PlatformLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platform sign-in",
  robots: { index: false, follow: false },
};

export default function PlatformLoginPage() {
  return <PlatformLoginForm />;
}
