import { call } from "redux-saga/effects"

import { PsnAuthStore } from "../../psn-auth-store"
import type {
  PersistPsnAccountAction,
  PersistProvisionalPsnTokensAction,
} from "../types"

// The single place PsnAuthStore.save() is called from. psn-account.ts's
// control flow only ever computes account/token state; the deciding of
// *whether* the tokens changed happens in-memory upstream (see
// check-psn-presence.ts and the bootstrap in app.ts), so this saga only ever
// runs when there's genuinely something new to write — no per-tick disk
// reads to diff against.
function* persistPsnAccount(
  action: PersistPsnAccountAction | PersistProvisionalPsnTokensAction,
) {
  if (action.type === "PERSIST_PROVISIONAL_PSN_TOKENS") {
    const { npsso, authInfo, accountName } = action.payload
    yield call(PsnAuthStore.save, PsnAuthStore.resolveKey(undefined, npsso), {
      npssoHash: PsnAuthStore.hashNpsso(npsso),
      accountId: undefined,
      accountName,
      authInfo,
    })
    return
  }

  const { accountId, npsso, authInfo, accountName } = action.payload
  yield call(
    PsnAuthStore.save,
    PsnAuthStore.resolveKey(accountId, npsso),
    {
      npssoHash: PsnAuthStore.hashNpsso(npsso),
      accountId,
      accountName,
      authInfo,
    },
    // Drop the provisional NPSSO-hash-keyed entry from any earlier
    // PERSIST_PROVISIONAL_PSN_TOKENS write now that the accountId-keyed entry
    // supersedes it (a no-op if there wasn't one).
    PsnAuthStore.resolveKey(undefined, npsso),
  )
}

export { persistPsnAccount }
