export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.1";

export const COMMIT_HASH: string =
  typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "";

export const VERSION_STRING: string = COMMIT_HASH
  ? `v${APP_VERSION} (${COMMIT_HASH})`
  : `v${APP_VERSION}`;
