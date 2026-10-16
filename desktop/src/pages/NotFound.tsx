import { Link } from "react-router";
import { PageHeader } from "../components/PageHeader";

export function NotFound() {
  return (
    <main className="dashboard">
      <PageHeader title="Page not found" subtitle="That route does not exist in this application." />
      <section className="panel shell-not-found">
        <p className="shell-error-code">404</p>
        <p>Choose a page from the sidebar or return to the dashboard.</p>
        <Link className="shell-return-link" to="/">Return to Dashboard</Link>
      </section>
    </main>
  );
}
