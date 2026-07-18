interface NavigateEvent extends Event {
  readonly canIntercept: boolean;
  readonly destination: { url: string };
  intercept(options: {
    handler: () => Promise<void>;
    scroll?: "manual" | "after-transition";
  }): void;
}

interface NavigationTransition {
  readonly committed: Promise<void>;
}

interface Navigation {
  readonly currentEntry: { getState(): unknown } | null;
  addEventListener(
    type: "navigate",
    listener: (event: NavigateEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "navigate",
    listener: (event: NavigateEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  navigate(
    url: string,
    options?: { history?: "replace" | "push" },
  ): NavigationTransition;
  updateCurrentEntry(options: { state: unknown }): void;
}

interface Window {
  navigation?: Navigation;
}
