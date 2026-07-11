import { defineHandler } from "../../../src/index.js";

const inheritedHandler = Object.create({
  event: "Stop",
  handler: async () => ({}),
});

export default "not a config";
export const metadata = 1;
export const inherited = inheritedHandler;
export const onStop = defineHandler("Stop", async () => ({}));
