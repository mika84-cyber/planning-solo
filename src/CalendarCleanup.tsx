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
          Touchez plusieurs cases, puis choisissez uniquement ce que vous
          souhaitez effacer.
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
    <button className={className} type="button" onClick={onStart}>
      Effacer plusieurs dates ou notes
    </button>
  );
}
