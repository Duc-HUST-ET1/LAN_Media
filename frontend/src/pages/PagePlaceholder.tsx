interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <>
      <h1>{title}</h1>
      <p className="intro">{description ?? `${title} features will be added in a later phase.`}</p>
    </>
  );
}
