import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";

/** Header link to the Skills page; carries the API URL so it opens on the same backend. */
export function SkillsLink({ apiUrl }: { apiUrl: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label="Skills"
    >
      <Link href={`/skills?apiUrl=${encodeURIComponent(apiUrl)}`}>
        <Sparkles className="size-5" />
      </Link>
    </Button>
  );
}
