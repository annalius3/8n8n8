import { FlowWizardForm } from "@/components/flow-wizard-form";
import { LinkButton } from "@/components/ui/link-button";

export default async function NewFlowPage() {
  return (
    <div className="space-y-4">
      <div>
        <LinkButton href="/flows" variant="outline">Назад к потокам</LinkButton>
      </div>
      <FlowWizardForm />
    </div>
  );
}
