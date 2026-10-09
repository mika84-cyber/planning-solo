import { useEffect, useRef, useState } from "react";
import type { FormProfile } from "./appModel";
import { readLocalPayslipVerifications, writeLocalPayslipVerifications } from "./payslipVerificationDecision";
import {
  mergePayslipVerifications,
  withoutPayslipVerification,
  withPayslipVerification,
  type PayslipVerificationRecord,
  type PayslipVerificationRecords,
} from "./payslipVerificationRecords";
import type { PayCalendarPost } from "./usePayActions";

type SetState<T> = (value: T | ((current: T) => T)) => void;

/**
 * Les décisions « Tout est OK » ou « Anomalie signalée » de chaque bulletin.
 * Connecté, elles sont gardées dans le compte et suivent sur tous les
 * appareils ; celles qu'un appareil gardait encore pour lui seul rejoignent
 * le compte à la première occasion. En démo, elles restent sur l'appareil.
 */
export function usePayslipVerifications({
  accountId,
  demoMode,
  formProfile,
  setFormProfile,
  post,
  notify,
}: {
  accountId: string;
  demoMode: boolean;
  formProfile: FormProfile | null;
  setFormProfile: SetState<FormProfile | null>;
  post: PayCalendarPost;
  notify: (message: string) => void;
}) {
  const [local, setLocal] = useState(() => readLocalPayslipVerifications(accountId));
  useEffect(() => setLocal(readLocalPayslipVerifications(accountId)), [accountId]);
  const synced = !demoMode && formProfile !== null;
  const remote = formProfile?.payslipVerifications ?? {};
  const records = synced ? mergePayslipVerifications(remote, local) : local;

  // Une seule reprise à la fois ; une fois enregistrées dans le compte, les
  // décisions de l'appareil sont effacées de celui-ci.
  const migrating = useRef(false);
  const pendingLocal = synced && Object.keys(local).length > 0;
  useEffect(() => {
    if (!pendingLocal || migrating.current) return;
    migrating.current = true;
    const next = mergePayslipVerifications(remote, local);
    post({ action: "save-form-profile", payslipVerifications: next })
      .then(() => {
        setFormProfile((current) => (current ? { ...current, payslipVerifications: next } : current));
        writeLocalPayslipVerifications(accountId, {});
        setLocal({});
      })
      .catch(() => {
        // Réessayé à la prochaine ouverture : rien n'est perdu.
      })
      .finally(() => {
        migrating.current = false;
      });
  }, [pendingLocal, remote, local, post, setFormProfile, accountId]);

  const update = async (next: PayslipVerificationRecords) => {
    if (!synced) {
      writeLocalPayslipVerifications(accountId, next);
      setLocal(next);
      return;
    }
    const previous = formProfile;
    setFormProfile((current) => (current ? { ...current, payslipVerifications: next } : current));
    try {
      await post({ action: "save-form-profile", payslipVerifications: next });
    } catch {
      setFormProfile(previous);
      notify("La vérification du bulletin n’a pas pu être enregistrée. Réessayez.");
    }
  };

  return {
    records,
    save: (record: PayslipVerificationRecord) => update(withPayslipVerification(records, record)),
    remove: (year: number, month: number) => update(withoutPayslipVerification(records, year, month)),
  };
}
