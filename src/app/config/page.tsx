import { GeneralSection } from "@/components/config/GeneralSection";

export default function ConfigurationPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl">
        <GeneralSection />
      </div>
    </div>
  );
}
