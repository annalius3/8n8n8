import { FlowWizardForm } from "@/components/flow-wizard-form";
import { LinkButton } from "@/components/ui/link-button";

export default async function NewFlowPage() {
  return (
    <div className="space-y-4">
      <div>
        <LinkButton href="/flows" variant="outline">К списку потоков</LinkButton>
      </div>
      <FlowWizardForm />
    </div>
  );
}

