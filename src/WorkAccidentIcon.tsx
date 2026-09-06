export function WorkAccidentIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`work-accident-symbol${className ? ` ${className}` : ""}`} aria-hidden="true">
      <img src="/work-accident-icon.png" alt="" draggable={false} />
    </span>
  );
}
