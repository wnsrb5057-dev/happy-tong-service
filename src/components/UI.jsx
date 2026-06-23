import {
  activityHealthLabels,
  checkerStatusLabels,
  checkTypeLabels,
  emergencyStatusLabels,
  issueLevelLabels,
  riskLabels,
  urgencyLabels,
  recordStatusLabels,
} from "../data/mockData.js";

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action ? <div className="header-action">{action}</div> : null}
    </header>
  );
}

export function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function AlertCard({ children, tone = "info", className = "" }) {
  return <section className={`card alert-card alert-${tone} ${className}`}>{children}</section>;
}

export function SectionTitle({ title, description, action }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, tone = "blue", helper }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} type="button" {...props}>
      {children}
    </button>
  );
}

export function TextInput({ label, id, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  );
}

export function SelectInput({ label, id, children, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}

export function TextArea({ label, id, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} {...props} />
    </label>
  );
}

export function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function StatusBadge({ type, value }) {
  let label = value;

  if (type === "risk") {
    label = riskLabels[value] ?? value;
  }

  if (type === "urgency") {
    label = urgencyLabels[value] ?? value;
  }

  if (type === "record") {
    label = recordStatusLabels[value] ?? value;
  }

  if (type === "health") {
    label = activityHealthLabels[value] ?? value;
  }

  if (type === "emergency") {
    label = emergencyStatusLabels[value] ?? value;
  }

  if (type === "checker") {
    label = checkerStatusLabels[value] ?? value;
  }

  if (type === "checkType") {
    label = checkTypeLabels[value] ?? value;
  }

  if (type === "issueLevel") {
    label = issueLevelLabels[value] ?? value;
  }

  return <span className={`badge badge-${type}-${value}`}>{label}</span>;
}

export function EmptyState({ title, description, children }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {children ? <div className="empty-action">{children}</div> : null}
    </div>
  );
}

export function InfoList({ items }) {
  return (
    <dl className="info-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
