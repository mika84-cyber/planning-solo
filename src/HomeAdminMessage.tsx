import { useEffect, useState } from 'react';
import { adminToolsApi, demoPin, type Pin } from './adminToolsApi';
import './adminHomeMessage.css';
export function HomeAdminMessage({ demoMode }: { demoMode: boolean }) {
  const [pin, setPin] = useState<Pin | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      setPin(current => current && Date.parse(current.until) <= Date.now() ? null : current);
      try { const data = demoMode ? { pin: demoPin } : await adminToolsApi<{ pin: Pin | null }>(undefined, true); if (active) setPin(data.pin && Date.parse(data.pin.until) > Date.now() ? data.pin : null); } catch { /* Le planning reste disponible hors ligne. */ }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 15000);
    const updated = () => void refresh(); window.addEventListener('admin-tools-updated', updated);
    return () => { active = false; clearInterval(timer); window.removeEventListener('admin-tools-updated', updated); };
  }, [demoMode]);
  return pin ? <aside className="admin-home-message" aria-label="Information de l’équipe"><strong>Information de l’équipe</strong><p>{pin.message}</p><small>Jusqu’au {new Date(pin.until).toLocaleString('fr-FR')}</small></aside> : null;
}
