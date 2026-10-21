import { EmptyState } from "../../../components/EmptyState";
import type { DashboardActivity } from "../data/mockDashboard";

interface RecentActivityProps {
  activities: readonly DashboardActivity[];
}

/** Activity is display-only today; a later data layer will supply records. */
export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <section className="overview-panel" aria-labelledby="recent-activity-title">
      <div className="overview-panel-heading">
        <div>
          <h2 id="recent-activity-title">Recent activity</h2>
          <p>Illustrative stock and catalog events</p>
        </div>
        <span className="overview-panel-tag">Demo</span>
      </div>
      {activities.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Sales, purchases and stock changes will appear here after they are recorded."
        />
      ) : (
        <ol className="overview-activity-list">
          {activities.map((activity) => (
            <li className="overview-activity-item" key={activity.id}>
              <span className={`overview-activity-marker overview-activity-marker--${activity.kind.toLowerCase()}`} aria-hidden="true" />
              <div className="overview-activity-copy">
                <strong>{activity.title}</strong>
                <p>{activity.detail}</p>
              </div>
              <time dateTime={activity.occurredAt}>{activity.displayTime}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
