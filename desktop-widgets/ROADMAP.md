# Project Roadmap

## App Launcher Enhancements

- [ ] Track app launches, sort by usage on initial load `@src/components/app-launcher.tsx`
- [ ] Add ability to bookmark apps, still in app launcher

## Network Status Refactoring

Refactor from simple polling to hybrid approach for ~10x efficiency gain:

- [x] Use `nmcli monitor` for connection change events (connect/disconnect/SSID changes)
- [x] Use `/proc/net/wireless` polling for signal strength updates (~1ms vs ~11ms)
- [x] Keep `nmcli` calls only for initial load and when monitor detects changes
- [x] Add `createNetworkMonitor()` helper that combines both approaches
