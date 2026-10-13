import { useEffect, useState } from 'react';
import { adminToolsApi, demoHolidayReminder, demoPin, type HolidayReminder, type Pin } from './adminToolsApi';
import './adminHomeMessage.css';
type Props = {
  demoMode: boolean;
  /** L'administrateur envoie le rappel : il ne le reçoit pas lui-même. */
  hideHolidayReminder: boolean;
  /** Fériés de l'année encore sans choix pour ce compte : travaillés et compensés. */
  holidayChoicesPending: (year: number) => { worked: number; compensated: number };
  onOpenHolidayChoices: (year: number) => void;
};
function active<T extends { until: string }>(item: T | null) { return item && Date.parse(item.until) > Date.now() ? item : null; }
export function HomeAdminMessage({ demoMode, hideHolidayReminder, holidayChoicesPending, onOpenHolidayChoices }: Props) {
  const [pin, setPin] = useState<Pin | null>(null);
  const [reminder, setReminder] = useState<HolidayReminder | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      setPin(current => active(current));
      try {
        const data = demoMode ? { pin: demoPin, holidayReminder: demoHolidayReminder } : await adminToolsApi<{ pin: Pin | null; holidayReminder?: HolidayReminder | null }>(undefined, true);
        if (mounted) { setPin(active(data.pin)); setReminder(active(data.holidayReminder ?? null)); }
      } catch { /* Le planning reste disponible hors ligne. */ }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 15000);
    const updated = () => void refresh(); window.addEventListener('admin-tools-updated', updated);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('admin-tools-updated', updated); };
  }, [demoMode]);
  const pending = reminder && !hideHolidayReminder ? holidayChoicesPending(reminder.year) : { worked: 0, compensated: 0 };
  const count = (n: number, label: string) => `${n} férié${n > 1 ? 's' : ''} ${label}${n > 1 ? 's' : ''}`;
  const pendingText = [pending.worked ? count(pending.worked, 'travaillé') : '', pending.compensated ? count(pending.compensated, 'compensé') : ''].filter(Boolean).join(' · ');
  return <>
    {pin ? <aside className="admin-home-message" aria-label="Information de l’équipe"><strong>Information de l’équipe</strong><p>{pin.message}</p><small>Jusqu’au {new Date(pin.until).toLocaleString('fr-FR')}</small></aside> : null}
    {reminder && pendingText ? <aside className="admin-home-message holiday-reminder" aria-label={`Jours fériés ${reminder.year}`}>
      <strong>Jours fériés {reminder.year} : vos choix</strong>
      <p>Indiquez votre choix pour chacun de vos jours fériés {reminder.year} pour que l’application puisse calculer vos primes.</p>
      <small>À choisir : {pendingText}</small>
      <button type="button" className="primary-action" onClick={() => onOpenHolidayChoices(reminder.year)}>Choisir mes jours fériés {reminder.year}</button>
    </aside> : null}
  </>;
}
