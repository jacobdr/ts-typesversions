import { TupleLiteralToUnion } from "./Utils";

export type ISupportedTsVersions = ["3.1", "3.0", "2.9", "2.8", "2.7"];
const SUPPORTED_TYPESCRIPT_VERSIONS = ["3.1", "3.0", "2.9", "2.8", "2.7"] as ISupportedTsVersions;

export type IAllowedTsVersion = TupleLiteralToUnion<ISupportedTsVersions>;

export const DEFAULT_TYPESCRIPT_VERSIONS = SUPPORTED_TYPESCRIPT_VERSIONS.sort().reverse();

// Minimum versions for TS features
export const TYPESCRIPT_MINIMUM_TS_VERSION = "3.1";
export const TYPESCRIPT_MINIMUM_DECLARATION_MAP_VERSION = "2.9";
