import bank from "@/data/test/bank.json";
import cards from "@/data/test/cards.json";
import follow from "@/data/test/follow.json";
import questions from "@/data/test/questions.json";
import tables from "@/data/test/tables.json";
import tail from "@/data/test/tail.json";

/**
 * Every data constant of the type test, as scripts/extract-test.mjs took it
 * from the test page. Server only: it reaches the browser through
 * /api/test-data, after sign-in.
 */
export const TEST_DATA: Record<string, unknown> = {
  ...questions,
  ...follow,
  ...cards,
  ...bank,
  ...tables,
  ...tail,
};
