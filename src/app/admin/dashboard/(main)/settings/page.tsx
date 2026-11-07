import SettingsView, { type ActiveTab } from "@/components/admin/SettingsView";

const TABS: readonly ActiveTab[] = ["clinic", "doctors", "admins", "printables"];

/** `?tab=doctors` opens that tab, so the setup checklist can link straight to it. */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "clinic";
  return <SettingsView initialTab={initialTab} />;
}
