import lodash from "lodash"
import { expectSaga } from "redux-saga-test-plan"

import { PsnAccount } from "../../../psn-account"
import { persistPsnAccount, updateAccount } from "../../action-creators"
import { Account, State } from "../../types"
import { checkPsnPresence } from "../check-psn-presence"

jest.mock("../../../psn-account")

const mockPsnUpdateAccount = jest.mocked(PsnAccount.updateAccount)

describe("Check PSN Presence saga", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test("can detect new account activity", async () => {
    const mockAccount = makeAccount()
    mockPsnUpdateAccount.mockResolvedValue(mockAccount)

    await expectSaga(checkPsnPresence)
      .withState(<State>{ accounts: { "0": mockAccount }, devices: {} })
      .put(updateAccount(mockAccount))
      .run()
  })

  test("persists the account when its tokens rotate", async () => {
    const staleAccount = makeAccount()
    const rotatedAccount = makeAccount({
      authInfo: {
        accessToken: "rotated-access-token",
        accessTokenExpiration: 0,
        refreshToken: "rotated-refresh-token",
        refreshTokenExpiration: 0,
      },
    })
    mockPsnUpdateAccount.mockResolvedValue(rotatedAccount)

    await expectSaga(checkPsnPresence)
      .withState(<State>{ accounts: { "0": staleAccount }, devices: {} })
      .put(updateAccount(rotatedAccount))
      .put(persistPsnAccount(rotatedAccount))
      .run()
  })

  test("does not persist when the account's tokens are unchanged", async () => {
    const account = makeAccount()
    // a distinct object with identical token values, as a real
    // no-op-refresh would produce — not the same reference as `account`
    mockPsnUpdateAccount.mockResolvedValue(makeAccount())

    await expectSaga(checkPsnPresence)
      .withState(<State>{ accounts: { "0": account }, devices: {} })
      .not.put.actionType("PERSIST_PSN_ACCOUNT")
      .run()
  })
})

// --- helpers ---

const DEFAULT_ACCOUNT: Account = {
  accountId: "0000000000",
  accountName: "TestUser",
  authInfo: {
    accessToken: "",
    accessTokenExpiration: 0,
    refreshToken: "",
    refreshTokenExpiration: 0,
  },
  npsso: "----",
  activity: undefined,
  preferredDevices: {},
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return lodash.merge({}, DEFAULT_ACCOUNT, overrides)
}
