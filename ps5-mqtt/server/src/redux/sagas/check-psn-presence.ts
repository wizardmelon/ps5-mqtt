import { call, put, select } from "redux-saga/effects"
import { PsnAccount } from "../../psn-account"
import { createErrorLogger } from "../../util/error-logger"
import { persistPsnAccount, updateAccount } from "../action-creators"
import { getAccounts } from "../selectors"
import { Account } from "../types"

// const debug = createDebugger("@ha:ps5:checkPsnPresence");
const errorLogger = createErrorLogger()

function* checkPsnPresence() {
  try {
    const accounts: Account[] = yield select(getAccounts)

    for (const account of accounts) {
      const updatedAccount = yield call<typeof PsnAccount.updateAccount>(
        PsnAccount.updateAccount,
        account,
      )

      // Fires every tick to carry fresh activity data for device matching;
      // stays fully in-memory (no disk touch).
      yield put(updateAccount(updatedAccount))

      // Only persist when the tokens actually rotated. updateAccount reuses
      // the existing access token while it's valid (~1h) and only rotates on
      // refresh, so this in-memory comparison keeps disk writes to roughly
      // hourly instead of once per presence-check tick (default every 5s).
      if (
        updatedAccount.authInfo.accessToken !== account.authInfo.accessToken ||
        updatedAccount.authInfo.refreshToken !== account.authInfo.refreshToken
      ) {
        yield put(persistPsnAccount(updatedAccount))
      }
    }
  } catch (e) {
    errorLogger(e)
  }
}

export { checkPsnPresence }
