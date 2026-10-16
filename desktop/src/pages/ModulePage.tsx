import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";

export interface ModulePageProps {
  title: string;
  description: string;
}

// Temporary route page: replace with a real feature page in a later lesson.
export function ModulePage({ title, description }: ModulePageProps) {
  return (
    <main className="dashboard">
      <PageHeader title={title} subtitle={description} />
      <section className="panel">
        <EmptyState
          title={`${title} is ready for development`}
          description="This screen is a navigation placeholder. No records are loaded or saved."
        />
      </section>
    </main>
  );
}
