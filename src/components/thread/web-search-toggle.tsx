import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

/** The composer's "Web Search" control (issue #18) -- sits in the same
 * settings row as "Hide Tool Calls" (src/components/thread/index.tsx). Its
 * checked value drives `webSearchConfigForRun` (src/lib/web-search.ts) on
 * the next `stream.submit`, not a deployment-wide setting: toggling it only
 * ever affects the run it's on when the message is sent. */
export function WebSearchToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="enable-web-search"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label
        htmlFor="enable-web-search"
        className="text-sm text-gray-600"
      >
        Web Search
      </Label>
    </div>
  );
}
