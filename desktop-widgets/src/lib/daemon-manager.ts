import { Effect } from "effect"

export class DaemonManager extends Effect.Service<DaemonManager>()(
  "DaemonManager",
  {
    sync: () => {
      return {}
    },
  },
) {}
