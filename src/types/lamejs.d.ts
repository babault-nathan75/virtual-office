declare module "lamejs" {
  class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps?: number, mode?: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
}
