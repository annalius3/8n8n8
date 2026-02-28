import { FlowWizardForm } from "@/components/flow-wizard-form";
import { LinkButton } from "@/components/ui/link-button";
import { SetupRequiredCard } from "@/components/setup-required-card";

export default async function NewFlowPage() {
  return (
    <div className="space-y-4">
      <div>
        <LinkButton href="/flows" variant="outline">Назад к потокам</LinkButton>
      </div>
      <SetupRequiredCard
        title="Перед созданием потока нужно завершить настройку окружения"
        details="Форма уже готова, но сохранение потока всё равно упрётся в базу данных. Сначала добавьте production ENV в Vercel, затем возвращайтесь к созданию flow."
      />
      <FlowWizardForm />
    </div>
  );
}
