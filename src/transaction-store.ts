// OAuth transaction storage - bridges /authorize and /callback
export type OAuthTransaction = {
  clientRedirectUri: string;
  clientState?: string;
  expiresAt: number;
};

const transactions = new Map<string, OAuthTransaction>();

export function storeTransaction(txnId: string, txn: OAuthTransaction): void {
  transactions.set(txnId, txn);
  setTimeout(() => transactions.delete(txnId), txn.expiresAt - Date.now());
}

export function consumeTransaction(
  txnId: string,
): OAuthTransaction | undefined {
  const txn = transactions.get(txnId);
  if (!txn || Date.now() > txn.expiresAt) {
    transactions.delete(txnId);
    return undefined;
  }
  transactions.delete(txnId);
  return txn;
}
