type QuickFact = {
  label: string;
  value: string;
};

type FormatQuickFactsProps = {
  facts: QuickFact[];
};

export function FormatQuickFacts({ facts }: FormatQuickFactsProps) {
  return (
    <ul className="format-quick-facts">
      {facts.map((fact) => (
        <li key={fact.label}>
          <span className="format-quick-facts__value">{fact.value}</span>
          <span className="format-quick-facts__label">{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}
