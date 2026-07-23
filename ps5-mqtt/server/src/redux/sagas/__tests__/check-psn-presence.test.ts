import { runSaga } from "redux-saga"

import { PsnAccount } from "../../../psn-account"
import { Account, AnyAction, State } from "../../types"
import { checkPsnPresence } from "../check-psn-presence"

// Note: action-creators are intentionally NOT mocked here. The saga dispatches
// their results via put(); mocking them to return undefined would make
// put(undefined) throw inside the saga's try/catch and silently swallow the
// rest of the loop. Using the real action creators + a dispatch spy also lets
// us assert on the actual actions that come out.
jest.mock("../../../psn-account")

const mockPsnUpdateAccount = jest.mocked(PsnAccount.updateAccount)

const mockAccount: Account = {
  accountId: "0000000000",
  accountName: "TestUser",
  authInfo: {
    accessToken: "access-token",
    accessTokenExpiration: 0,
    refreshToken: "refresh-token",
    refreshTokenExpiration: 0,
  },
  npsso: "----",
  activity: undefined,
  preferredDevices: {},
}

function runCheckPsnPresence(): Promise<AnyAction[]> {
  const dispatched: AnyAction[] = []
  return runSaga(
    {
      dispatch: (action: AnyAction) => dispatched.push(action),
      getState: () =>
        <Partial<State>>{
          accounts: {
            "0": mockAccount,
          },
        },
    },
    checkPsnPresence,
  )
    .toPromise()
    .then(() => dispatched)
}

// https://redux-saga.js.org/docs/advanced/Testing/
describe("Check PSN Presence saga", () => {
  afterEach(() => {
    mockPsnUpdateAccount.mockReset()
  })

  test("dispatches UPDATE_PSN_ACCOUNT every tick to carry fresh activity", async () => {
    mockPsnUpdateAccount.mockResolvedValue({
      ...mockAccount,
      activity: {
        titleId: "T",
        titleImage: "img",
        titleName: "Game",
        platform: "PS5",
        launchPlatform: "PS5",
      },
    })

    const dispatched = await runCheckPsnPresence()

    expect(dispatched.map((a) => a.type)).toContain("UPDATE_PSN_ACCOUNT")
  })

  test("persists the account only when its tokens have rotated", async () => {
    mockPsnUpdateAccount.mockResolvedValue({
      ...mockAccount,
      authInfo: {
        ...mockAccount.authInfo,
        accessToken: "rotated-access-token",
        refreshToken: "rotated-refresh-token",
      },
    })

    const dispatched = await runCheckPsnPresence()

    const persist = dispatched.find((a) => a.type === "PERSIST_PSN_ACCOUNT")
    expect(persist).toBeDefined()
    expect((persist as { payload: Account }).payload.authInfo).toEqual(
      expect.objectContaining({
        accessToken: "rotated-access-token",
        refreshToken: "rotated-refresh-token",
      }),
    )
  })

  test("does not persist when the tokens are unchanged", async () => {
    mockPsnUpdateAccount.mockResolvedValue({ ...mockAccount })

    const dispatched = await runCheckPsnPresence()

    expect(dispatched.map((a) => a.type)).toContain("UPDATE_PSN_ACCOUNT")
    expect(dispatched.map((a) => a.type)).not.toContain("PERSIST_PSN_ACCOUNT")
  })
})
