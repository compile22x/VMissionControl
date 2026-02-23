import { InputDevicesSection } from "@/components/config/InputDevicesSection";

export default function InputPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl">
        <InputDevicesSection />
      </div>
    </div>
  );
}
