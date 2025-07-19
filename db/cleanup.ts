import { closePgPool } from "./mod.ts";
import { closeRpcPgPool } from "./rpc/mod.ts";
import { closeSignaturesPgPool } from "./signatures/mod.ts";

export async function closeAllDbPools() {
  const promises = [
    closePgPool(),
    closeRpcPgPool(), 
    closeSignaturesPgPool()
  ];
  
  await Promise.allSettled(promises);
  console.log("All database pools closed");
}