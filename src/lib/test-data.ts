import "server-only";
import { TEST_PARTS } from "@/data/test";

/**
 * Every data constant of the type test, as scripts/extract-test.mjs took it
 * from the test page. Server only: it reaches the browser through
 * /api/test-data, after sign-in.
 */
export const TEST_DATA: Record<string, unknown> = Object.assign({}, ...TEST_PARTS);
