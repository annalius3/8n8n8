import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { FlowWizardForm } from "@/components/flow-wizard-form";
import { Button } from "@/components/ui/button";

export default async function NewFlowPage() {
  await requireUser();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/flows">
          <Button variant="outline">Назад к потокам</Button>
        </Link>
      </div>
      <FlowWizardForm />
    </div>
  );
}
