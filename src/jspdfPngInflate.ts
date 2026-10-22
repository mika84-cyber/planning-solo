// Remplace pako, que fast-png (le décodeur PNG de jsPDF) n'utilise que pour
// décompresser les images PNG des PDF : modèles des formulaires CET,
// signature, cases du planning. fflate, que jsPDF livre déjà pour compresser
// ses PDF, sait faire la même chose : pako ajoutait 46 Kio pour rien.
//
// fast-png pousse les morceaux de l'image (IDAT) l'un après l'autre, vérifie
// `err` puis lit `result` une fois l'image entière : les morceaux sont donc
// réunis, puis décompressés d'un coup à la lecture. Son encodeur PNG
// (deflate) n'est jamais appelé par jsPDF.
import { unzlibSync } from "fflate";

export const inflate = (data: Uint8Array) => unzlibSync(data);

export class Inflate {
  err = 0;
  private chunks: Uint8Array[] = [];
  private inflated?: Uint8Array;

  push(chunk: Uint8Array) {
    this.chunks.push(chunk);
    this.inflated = undefined;
    return true;
  }

  get result() {
    if (!this.inflated) {
      const data = new Uint8Array(this.chunks.reduce((size, chunk) => size + chunk.length, 0));
      let offset = 0;
      for (const chunk of this.chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      this.inflated = unzlibSync(data);
    }
    return this.inflated;
  }
}

export function deflate(): never {
  throw new Error("Encodeur PNG de fast-png non livré avec l'application.");
}
