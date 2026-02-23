"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataValue } from "@/components/ui/data-value";
import { useToast } from "@/components/ui/toast";
import { Download, Trash2 } from "lucide-react";

export function DataSection() {
  const [retention, setRetention] = useState("24h");
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Data Management</h2>

      <Card>
        <div className="space-y-4">
          <Select
            label="Telemetry retention"
            value={retention}
            onChange={setRetention}
            options={[
              { value: "1h", label: "1 hour" },
              { value: "6h", label: "6 hours" },
              { value: "24h", label: "24 hours" },
              { value: "7d", label: "7 days" },
            ]}
          />

          <DataValue label="Storage used" value="12.4" unit="MB" />
        </div>
      </Card>

      <Card title="Actions">
        <div className="space-y-3">
          <Button
            variant="secondary"
            icon={<Download size={14} />}
            onClick={() => toast("Export not available in demo mode", "info")}
            className="w-full"
          >
            Export flight data
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => toast("Cache cleared", "success")}
            className="w-full"
          >
            Clear telemetry cache
          </Button>
        </div>
      </Card>
    </div>
  );
}
