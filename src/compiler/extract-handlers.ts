import type { HandlerOptions } from "../types/mapping.js";
import type { LoadedConfig } from "./load-config.js";

export interface HandlerEntry extends HandlerOptions {
  event: string;
  name: string;
}

export function extractHandlers(loaded: LoadedConfig): HandlerEntry[] {
  const byEvent = Map.groupBy(
    Object.entries(loaded.handlerExports),
    ([, handler]) => handler.event,
  );

  return [...byEvent.entries()].flatMap(([event, entries]) =>
    entries.map(([name, handler]) => {
      const { event: _event, handler: _handler, ...options } = handler;
      return { ...options, event, name };
    }),
  );
}
