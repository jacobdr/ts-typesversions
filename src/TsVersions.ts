import { TupleLiteralToUnion } from "./Utils";

export type ISupportedTsVersions = ["3.1", "3.0", "2.9"];

export type IAllowedTsVersion = TupleLiteralToUnion<ISupportedTsVersions>;

export const DEFAULT_TYPESCRIPT_VERSIONS = ["3.1", "3.0", "2.9"]
    .sort()
    .reverse() as ISupportedTsVersions;
