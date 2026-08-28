type CalendarCleanupPanelProps = {
  selectedCount: number;
  busy: boolean;
  onCancel: () => void;
  onDeleteAbsences: () => void;
  onDeleteNotes: () => void;
};

function pluralSuffix(count: number) {
  return count >= 2 ? "s" : "";
}

export function CalendarCleanupPanel({
  selectedCount,
  busy,
  onCancel,
  onDeleteAbsences,
  onDeleteNotes,
}: CalendarCleanupPanelProps) {
  return (
    <section className="calendar-delete-panel" aria-label="Suppression multiple">
      <div>
        <span className="step-label">Nettoyer le planning</span>
        <h2>
          {selectedCount} date{pluralSuffix(selectedCount)} sélectionnée
          {pluralSuffix(selectedCount)}
        </h2>
        <p>
          Vous pouvez effacer plusieurs dates ou notes en même temps. Faites
          votre choix directement dans le planning.
        </p>
      </div>
      <div className="calendar-delete-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Annuler
        </button>
        <button
          className="danger-button delete-absences-button"
          type="button"
          disabled={!selectedCount || busy}
          onClick={onDeleteAbsences}
        >
          Effacer les absences
        </button>
        <button
          className="warning-button delete-notes-button"
          type="button"
          disabled={!selectedCount || busy}
          onClick={onDeleteNotes}
        >
          Effacer les notes
        </button>
      </div>
    </section>
  );
}

export function CalendarCleanupTrigger({
  className,
  onStart,
}: {
  className: string;
  onStart: () => void;
}) {
  return (
    <button
      className={className}
      type="button"
      onClick={onStart}
      aria-label="Effacer plusieurs dates ou notes"
    >
      <svg
        className="calendar-cleanup-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
      </svg>
      <span className="calendar-cleanup-label-full">
        Effacer plusieurs dates ou notes
      </span>
      <span className="calendar-cleanup-label-short" aria-hidden="true">
        Effacer
      </span>
    </button>
  );
}
