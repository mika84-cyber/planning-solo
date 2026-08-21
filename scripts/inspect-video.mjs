import { mkdir, writeFile } from "node:fs/promises";

const version = await fetch("http://127.0.0.1:9224/json/version").then((response) => response.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const item = pending.get(message.id);
  pending.delete(message.id);
  message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const target = await send("Target.createTarget", {
  url: "file:///D:/Downloads/WhatsApp%20Video%202026-08-20%20at%2021.59.08.mp4",
});
const attached = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
const call = (method, params = {}) => send(method, params, attached.sessionId);
await call("Page.enable");
await call("Runtime.enable");
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
};
for (let index = 0; index < 100; index++) {
  if (await evaluate("document.querySelector('video')?.duration > 0")) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
const duration = await evaluate("document.querySelector('video').duration");
await mkdir("video-frames", { recursive: true });
const times = Array.from({ length: 12 }, (_, index) => (duration * index) / 11);
for (let index = 0; index < times.length; index++) {
  await evaluate(`new Promise(resolve => {
    const video = document.querySelector('video');
    video.addEventListener('seeked', resolve, { once: true });
    video.currentTime = ${times[index]};
  })`);
  const capture = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(`video-frames/frame-${String(index).padStart(2, "0")}.png`, Buffer.from(capture.data, "base64"));
}
console.log(JSON.stringify({ duration, times }, null, 2));
await send("Target.closeTarget", { targetId: target.targetId });
socket.close();
