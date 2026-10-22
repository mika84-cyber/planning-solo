import { Inflate as PakoInflate, inflate as pakoInflate } from "pako";
import { describe, expect, it } from "vitest";
import { Inflate, deflate, inflate } from "./jspdfPngInflate";
import cetTemplate from "../public/cet/formulaire-ouverture-cet.png?inline";

const same = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

/** Les morceaux de données (IDAT) d'un PNG, tels que fast-png les pousse. */
function idatChunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === "IDAT") chunks.push(new Uint8Array(png.buffer, png.byteOffset + offset + 8, length));
    offset += length + 12;
  }
  return chunks;
}

describe("décompression des PNG de jsPDF sans pako", () => {
  it("rend, morceau après morceau, les mêmes pixels que pako sur un vrai modèle CET", () => {
    const png = Uint8Array.from(atob(cetTemplate.split(",")[1]), (character) => character.charCodeAt(0));
    const chunks = idatChunks(png);
    expect(chunks.length).toBeGreaterThan(1);
    const expected = new PakoInflate();
    const actual = new Inflate();
    for (const chunk of chunks) {
      expected.push(chunk);
      actual.push(chunk);
      expect(actual.err).toBe(0);
    }
    expect(same(actual.result, expected.result as Uint8Array)).toBe(true);
    // Le profil de couleur (iCCP) se décompresse d'un coup.
    const whole = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    chunks.reduce((offset, chunk) => (whole.set(chunk, offset), offset + chunk.length), 0);
    expect(same(inflate(whole), pakoInflate(whole))).toBe(true);
  });

  it("signale une image corrompue, et refuse d'encoder", () => {
    const broken = new Inflate();
    broken.push(new Uint8Array([1, 2, 3, 4]));
    expect(() => broken.result).toThrow();
    expect(() => deflate()).toThrow(/non livré/);
  });
});
