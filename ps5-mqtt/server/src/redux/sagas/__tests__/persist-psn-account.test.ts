import { runSaga } from "redux-saga"

import { PsnAuthStore } from "../../../psn-auth-store"
import type {
  Account,
  PersistPsnAccountAction,
  PersistProvisionalPsnTokensAction,
} from "../../types"
import { persistPsnAccount } from "../persist-psn-account"

jest.mock("../../../psn-auth-store")

const mockedSave = jest.mocked(PsnAuthStore.save)
const mockedResolveKey = jest.mocked(PsnAuthStore.resolveKey)
const mockedHashNpsso = jest.mocked(PsnAuthStore.hashNpsso)

const npsso = "npsso-value"

const account: Account = {
  accountId: "account-1",
  accountName: "MyPsnUser",
  npsso,
  authInfo: {
    accessToken: "fresh-access-token",
    accessTokenExpiration: Date.now() + 1000 * 60 * 60,
    refreshToken: "fresh-refresh-token",
    refreshTokenExpiration: Date.now() + 1000 * 60 * 60 * 24 * 60,
  },
  preferredDevices: {},
}

function run(
  action: PersistPsnAccountAction | PersistProvisionalPsnTokensAction,
) {
  return runSaga(
    { dispatch: () => {}, getState: () => undefined },
    persistPsnAccount,
    action,
  ).toPromise()
}

describe("persistPsnAccount saga", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedResolveKey.mockImplementation((accountId, rawNpsso) =>
      accountId ? accountId : `hash(${rawNpsso})`,
    )
    mockedHashNpsso.mockImplementation((rawNpsso) => `hash(${rawNpsso})`)
  })

  test("persists a full account keyed by accountId, migrating away from the provisional key", async () => {
    await run({ type: "PERSIST_PSN_ACCOUNT", payload: account })

    expect(mockedSave).toHaveBeenCalledWith(
      "account-1",
      {
        npssoHash: `hash(${npsso})`,
        accountId: "account-1",
        accountName: "MyPsnUser",
        authInfo: account.authInfo,
      },
      `hash(${npsso})`,
    )
  })

  test("persists provisional tokens keyed by the NPSSO hash, with no accountId yet", async () => {
    await run({
      type: "PERSIST_PROVISIONAL_PSN_TOKENS",
      payload: {
        npsso,
        authInfo: account.authInfo,
        accountName: "MyPsnUser",
      },
    })

    expect(mockedSave).toHaveBeenCalledWith(`hash(${npsso})`, {
      npssoHash: `hash(${npsso})`,
      accountId: undefined,
      accountName: "MyPsnUser",
      authInfo: account.authInfo,
    })
  })

  test("does not read from disk to decide whether to write", async () => {
    await run({ type: "PERSIST_PSN_ACCOUNT", payload: account })

    // The change-detection is done in-memory upstream (check-psn-presence /
    // bootstrap); this saga must never touch the disk read path just to diff.
    expect(PsnAuthStore.findByNpsso).not.toHaveBeenCalled()
    expect(mockedSave).toHaveBeenCalledTimes(1)
  })
})
