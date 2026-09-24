interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  const icon = title === 'Calls' ? '☎' : title === 'Files' ? '▤' : '⚙';
  return (
    <section className="placeholder-view">
      <div className="placeholder-icon" aria-hidden="true">{icon}</div>
      <span className="placeholder-kicker">LAN-MEDIA</span>
      <h1>{title}</h1>
      <p>{description ?? `${title} will be available in a later phase.`}</p>
      <span className="placeholder-status">Coming soon</span>
    </section>
  );
}
