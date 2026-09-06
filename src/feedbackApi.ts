export type FeedbackKind = "idea" | "suggestion" | "bug";
export type FeedbackPhotoPayload = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  contentBase64: string;
};
export type FeedbackMessage = {
  id: string;
  kind: FeedbackKind;
  message: string;
  anonymous: boolean;
  authorName?: string;
  createdAt: string;
  readAt?: string;
  resolvedAt?: string;
  adminReplies?: Array<{ id: string; message: string; sentAt: string }>;
  hasPhoto: boolean;
};
export type FeedbackResolutionNotice = {
  id: string;
  feedbackId?: string;
  kind: FeedbackKind;
  type?: "resolved" | "reply";
  message?: string;
  createdAt?: string;
  resolvedAt?: string;
};

export const FEEDBACK_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1440;

async function parse<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok) throw new Error(body?.error || "La messagerie est momentanément indisponible.");
  return (body || {}) as T;
}

function supportedType(file: File): file is File & { type: FeedbackPhotoPayload["contentType"] } {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

async function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Cette photo n’a pas pu être lue."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Cette photo n’a pas pu être préparée.")),
    "image/jpeg",
    quality,
  ));
}

export async function prepareFeedbackPhoto(file: File): Promise<FeedbackPhotoPayload> {
  if (!supportedType(file)) throw new Error("Choisissez une photo JPEG, PNG ou WebP.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Cette photo est trop volumineuse (15 Mo maximum).");
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Cette photo n’a pas pu être réduite. Choisissez une image de moins de 2 Mo.");
    return { contentType: file.type, contentBase64: await toBase64(file) };
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let longestSide = MAX_IMAGE_SIDE;
    for (const quality of [0.84, 0.72]) {
      const ratio = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Cette photo n’a pas pu être préparée.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES)
        return { contentType: "image/jpeg", contentBase64: await toBase64(blob) };
      longestSide = 1080;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Cette photo reste trop volumineuse. Essayez une autre image.");
}

export async function sendFeedback(payload: {
  kind: FeedbackKind;
  message: string;
  anonymous: boolean;
  photo?: FeedbackPhotoPayload;
}) {
  return parse<{ sent: boolean; notified: boolean }>(await fetch("/api/feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function getFeedbackInbox() {
  return parse<{ unreadCount: number; messages: FeedbackMessage[] }>(await fetch("/api/feedback", { cache: "no-store", credentials: "same-origin" }));
}

export async function getFeedbackSummary() {
  return parse<{ unreadCount: number }>(await fetch("/api/feedback?summary=1", { cache: "no-store", credentials: "same-origin" }));
}

export async function getFeedbackResolutionNotices() {
  return parse<{ notifications: FeedbackResolutionNotice[] }>(await fetch("/api/feedback?notifications=1", { cache: "no-store", credentials: "same-origin" }));
}

async function feedbackAction<T>(action: string, id: string) {
  return parse<T>(await fetch("/api/feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, id }),
  }));
}

async function feedbackMessageAction<T>(action: string, id: string, message: string) {
  return parse<T>(await fetch("/api/feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, id, message }),
  }));
}

export const markFeedbackRead = (id: string) => feedbackAction<{ read: true }>("mark-read", id);
export const resolveFeedback = (id: string) => feedbackAction<{ resolved: true }>("resolve", id);
export const deleteFeedback = (id: string) => feedbackAction<{ deleted: true }>("delete", id);
export const replyToFeedback = (id: string, message: string) => feedbackMessageAction<{ replied: true; reply: { id: string; message: string; sentAt: string } }>("reply", id, message);
export const dismissFeedbackResolution = (id: string) => feedbackAction<{ dismissed: true }>("dismiss-resolution", id);
export const feedbackPhotoUrl = (id: string) => `/api/feedback?photo=${encodeURIComponent(id)}`;
