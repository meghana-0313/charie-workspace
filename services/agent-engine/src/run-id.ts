// Run directory naming contract. The portal pre-assigns the run dir via
// GHOSTQA_RUN_ID so it can poll status; CLI runs without it generate a stamp.
// Both sides must agree verbatim — see test/regression.test.mts.
export function runDirName(stamp: string, verifyMode: boolean): string {
  return process.env.GHOSTQA_RUN_ID ?? (verifyMode ? `${stamp}-verify` : stamp);
}
