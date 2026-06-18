declare module "@0glabs/0g-ts-sdk" {
  import type { Wallet } from "ethers";

  export class MemData {
    constructor(data: Buffer | Uint8Array);
    merkleTree(): Promise<[unknown, Error | null]>;
  }

  export class Indexer {
    constructor(rpc: string);
    upload(
      data: MemData,
      flowOrRpc: string,
      signer: Wallet,
      options?: { encryption?: { type: "aes256"; key: Buffer } }
    ): Promise<[unknown, Error | null]>;
  }
}
