import { createRpcCall } from "../../../../db/rpc/mod.ts";

const MAX_ENCODING = "jsonParsed";
const MAX_SUPPORTED_TRANSACTION_VERSION = 0;

export async function requestGetTransaction(signature: string): Promise<string> {
    const params = [
      signature,
      {
        encoding: MAX_ENCODING,
        maxSupportedTransactionVersion: MAX_SUPPORTED_TRANSACTION_VERSION,
      }
    ];
  
    return await createRpcCall({
      method: "getTransaction",
      params,
    });
  }