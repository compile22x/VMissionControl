     STDIN
   1 #!/bin/bash
   2 for file in src/lib/protocol/mavlink-parser.ts src/lib/protocol/types/enums.ts src/lib/protocol/param-metadata.ts src/components/fc/ParametersPanel.tsx src/components/planner/MissionEditor.tsx src/stores/telemetry-store.ts src/stores/drone-store.ts src/lib/protocol/mavlink-adapter.ts src/lib/protocol/firmware/betaflight-manifest.ts src/components/fc/OsdEditorPanel.tsx; do
   3   if [ -f "$file" ]; then
   4     count=$(grep -c . "$file" 2>/dev/null || echo "0")
   5     echo "$count $file"
   6   fi
   7 done | sort -rn
