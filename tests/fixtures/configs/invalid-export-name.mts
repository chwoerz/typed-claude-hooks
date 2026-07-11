import { defineHandler } from "../../../src/index.js";

const invalidName = defineHandler("Stop", async () => ({}));

export { invalidName as "not-an-identifier" };
