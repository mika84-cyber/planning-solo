import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  isMikaSharingAccount: vi.fn(),
  forwardNotificationRequest: vi.fn(),
}));

vi.mock("@netlify/identity", () => ({ getUser: mocks.getUser }));
vi.mock("../lib/sharedCalendarBridge.mts", () => ({
  isMikaSharingAccount: mocks.isMikaSharingAccount,
  forwardNotificationRequest: mocks.forwardNotificationRequest,
}));

import handler from "../functions/notifications.mts";

const request = (method = "GET", body?: string, origin = "https://planning-solo.netlify.app") => new Request(
  "https://planning-solo.netlify.app/api/notifications",
  { method, headers: { origin, ...(body ? { "content-type": "application/json" } : {}) }, body },
);

describe("fonction de notifications privées", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ email: "admin@example.test" });
    mocks.isMikaSharingAccount.mockResolvedValue(true);
    mocks.forwardNotificationRequest.mockResolvedValue(new Response(JSON.stringify({ notifications: [] }), { status: 200 }));
  });

  it("refuse les origines tierces et les personnes non connectées", async () => {
    expect((await handler(request("POST", JSON.stringify({ action: "dismiss" }), "https://attaque.example"))).status).toBe(403);
    mocks.getUser.mockResolvedValueOnce(null);
    expect((await handler(request())).status).toBe(401);
  });

  it("réserve la route au compte administrateur et aux méthodes prévues", async () => {
    mocks.isMikaSharingAccount.mockResolvedValueOnce(false);
    expect((await handler(request())).status).toBe(403);
    expect((await handler(request("DELETE"))).status).toBe(405);
  });

  it("transmet les lectures et écritures valides au pont privé", async () => {
    expect((await handler(request())).status).toBe(200);
    expect(mocks.forwardNotificationRequest).toHaveBeenCalledWith("GET", undefined);
    expect((await handler(request("POST", JSON.stringify({ action: "dismiss", id: "notice-1" })))).status).toBe(200);
    expect(mocks.forwardNotificationRequest).toHaveBeenLastCalledWith("POST", { action: "dismiss", id: "notice-1" });
  });

  it("rejette un JSON invalide et signale un pont indisponible", async () => {
    expect((await handler(request("POST", "{"))).status).toBe(400);
    mocks.forwardNotificationRequest.mockResolvedValueOnce(null);
    expect((await handler(request())).status).toBe(503);
  });
});
