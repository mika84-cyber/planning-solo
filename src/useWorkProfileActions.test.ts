import { describe, expect, it, vi } from "vitest";
import type { FormProfile } from "./appModel";
import { useWorkProfileActions } from "./useWorkProfileActions";

/** Un profil qui porte ce que seuls d'autres écrans enregistrent : un bulletin
 *  vérifié, un bulletin qui cale les taux, un report de dimanches. */
const profile = {
  fullName: "Agent",
  group: "2",
  signature: "",
  status: "contractuel",
  workQuota: "full",
  baseSalary: 2253.22,
  sundayCarryover: 2,
  payslipVerifications: { "2026-10": { status: "ok" } },
  payslipRateSamples: { "2026-10": { gross: 2635.13, netBeforeTax: 2050.89 } },
} as unknown as FormProfile;

function actions(formProfile: FormProfile | null) {
  const setFormProfile = vi.fn();
  const post = vi.fn(() => Promise.resolve({}));
  // Aucun état React dans ce module : il s'appelle comme une fonction.
  const result = useWorkProfileActions({
    demoMode: false,
    group: 2,
    setGroup: vi.fn(),
    formProfile,
    setFormProfile,
    setPayProfileOpen: vi.fn(),
    notify: vi.fn(),
    post: post as never,
  });
  return { ...result, setFormProfile, post };
}

describe("useWorkProfileActions", () => {
  it("change la quotité sans faire oublier les bulletins vérifiés ni ceux qui calent les taux", () => {
    const { changeWorkQuota, setFormProfile, post } = actions(profile);
    changeWorkQuota("four_fifths");
    const next = setFormProfile.mock.calls[0][0] as FormProfile;
    expect(next).toMatchObject({ ...profile, workQuota: "four_fifths" });
    expect(next.payslipVerifications).toBe(profile.payslipVerifications);
    expect(next.payslipRateSamples).toBe(profile.payslipRateSamples);
    expect(next.sundayCarryover).toBe(2);
    // Seule la quotité part au serveur, avec l'identité du profil.
    expect(post).toHaveBeenCalledWith({ action: "save-form-profile", fullName: "Agent", group: "2", signature: "", workQuota: "four_fifths" });
  });

  it("change le statut et le groupe de la même façon", () => {
    const status = actions(profile);
    status.changeStatus("fonctionnaire");
    expect(status.setFormProfile.mock.calls[0][0]).toMatchObject({ status: "fonctionnaire", workQuota: "full", payslipRateSamples: profile.payslipRateSamples });
    expect(status.post).toHaveBeenCalledWith(expect.objectContaining({ status: "fonctionnaire" }));
    const group = actions(profile);
    group.changeGroup(3);
    expect(group.setFormProfile.mock.calls[0][0]).toMatchObject({ group: "3", status: "contractuel", payslipVerifications: profile.payslipVerifications });
    expect(group.post).toHaveBeenCalledWith(expect.objectContaining({ group: "3" }));
  });

  it("crée le profil à partir du groupe affiché quand il n’existe pas encore", () => {
    const { changeWorkQuota, setFormProfile } = actions(null);
    changeWorkQuota("half");
    expect(setFormProfile.mock.calls[0][0]).toMatchObject({ fullName: "", group: "2", signature: "", workQuota: "half" });
  });
});
