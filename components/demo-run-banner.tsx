import { Badge } from "@/components/ui/badge";

type DemoRunBannerProps = {
  isDemo: boolean;
  text: string;
};

export function DemoRunBanner({ isDemo, text }: DemoRunBannerProps) {
  if (!isDemo) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Demo run</Badge>
        <span>{text}</span>
      </div>
    </div>
  );
}
