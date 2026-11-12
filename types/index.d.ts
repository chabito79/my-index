export type ViewState = { query: string; open: number | null }

declare module 'claude-code' {
  interface PluginState {
    'my-index': { view: Shaped<ViewState> }
  }
}
