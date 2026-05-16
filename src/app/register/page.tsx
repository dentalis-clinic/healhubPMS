import { Suspense } from "react";
import RegisterWizard from "./RegisterWizard";

export const metadata = {
  title: "Create your clinic — HealthHub",
  description: "Set up your clinic on HealthHub and start managing appointments.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterWizard />
    </Suspense>
  );
}
