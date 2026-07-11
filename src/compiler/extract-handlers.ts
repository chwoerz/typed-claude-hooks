import type { HandlerOptions } from "../types/mapping.js";
import type { LoadedConfig } from "./load-config.js";

export interface HandlerEntry extends HandlerOptions {
  event: string;
  name: string;
}

export function extractHandlers(loaded: LoadedConfig): HandlerEntry[] {
  return Object.entries(loaded.handlerExports).map(([name, handler]) => {
    const { event, handler: _handler, ...options } = handler;
    return { ...options, event, name };
  });
}
