import { setUsingMocks } from "./api/client"
import { resetMockData } from "./api/mocks/store"

/** "Load demo school" - switches the whole app onto the in-memory mock data
 * layer (a full, realistic Indian school: 20 teachers, 10 subjects, 10
 * classes, 14 rooms) with one click, so anyone reviewing this portfolio
 * piece sees a fully populated app without needing the real backend or
 * database running. */
export function loadDemoSchool() {
  resetMockData()
  setUsingMocks(true)
}

export function exitDemoMode() {
  setUsingMocks(false)
}
