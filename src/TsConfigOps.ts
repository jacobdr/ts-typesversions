import BPromise from "bluebird";
import merge = require("webpack-merge");

import { CompilerOptions } from "typescript-2.7";
import { FileOps, FilePath, IReadJson } from "./FileOps";
import {
    IAllowedTsVersion,
    TYPESCRIPT_MINIMUM_DECLARATION_MAP_VERSION,
    TYPESCRIPT_MINIMUM_TS_VERSION,
} from "./TsVersions";

export interface ITsConfigObject {
    exclude: string[];
    compilerOptions: CompilerOptions;
}

export type ITypesVersionsSection = {
    [TsVersion in IAllowedTsVersion]?: {
        ["*"]: string[];
    }
};

type TsConfigRead = IReadJson<Partial<ITsConfigObject>>;

export class TsConfig {
    static readonly TYPES_VERSIONS_KEY = "typesVersions";
    static readonly TYPES_KEY = "types";
    static readonly defaultTsVersionsDirPrefix = "ts-types-versions-";

    static generateTypesVersionsSection(
        tsVersions: IAllowedTsVersion[],
        tsVersionsDirPrefix: string,
        outputDirectory: string
    ): ITypesVersionsSection {
        // Need to make sure to sort + reverse, since we want the great typescript versions at
        // the top -- i.e. 3.2 needs to come before 3.1 for resolution to work properly
        // https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#version-selection-with-typesversions
        return tsVersions
            .sort()
            .reverse()
            .map(version => {
                if (parseFloat(version) < parseFloat(TYPESCRIPT_MINIMUM_TS_VERSION)) {
                    return {};
                }
                const typingsOutputDir = FileOps.join(
                    [outputDirectory, this.typingsDirName(tsVersionsDirPrefix, version)],
                    false
                );
                const typingsOutputDirString = `${typingsOutputDir}/*`;
                return {
                    [`>=${version}`]: {
                        "*": [typingsOutputDirString],
                    },
                };
            })
            .reduce((prev, current) => ({ ...prev, ...current }), {});
    }

    static generateTypesSectionPath(
        packageJsonMainEntry: string | undefined,
        tsVersion: IAllowedTsVersion,
        tsVersionsDirPrefix: string,
        outputDirectory: string
    ) {
        const currentPackageJsonEntryFile = packageJsonMainEntry
            ? FileOps.baseName(packageJsonMainEntry)
            : "index.js";
        const entryDeclarationName = currentPackageJsonEntryFile.replace(".js", ".d.ts");

        return FileOps.join(
            [
                outputDirectory,
                this.typingsDirName(tsVersionsDirPrefix, tsVersion),
                entryDeclarationName,
            ],
            false
        );
    }

    static typingsDirName(prefix: string, tsVersion: string) {
        return `${prefix}${tsVersion}`;
    }

    private readonly _tsConfigRead: BPromise<TsConfigRead>;

    constructor(
        readonly filePath: string,
        readonly tsVersion: string,
        readonly tsVersionsDirPrefix = TsConfig.defaultTsVersionsDirPrefix
    ) {
        this._tsConfigRead = FileOps.readJson<Partial<ITsConfigObject>>(filePath);
    }

    get typingsDir() {
        return this.outputDir.then(outDir =>
            FileOps.join(
                [outDir, TsConfig.typingsDirName(this.tsVersionsDirPrefix, this.tsVersion)],
                false
            )
        );
    }

    get tsConfigContents() {
        return this._tsConfigRead.then(v => v.contents);
    }

    get tsConfigAttributes() {
        return this._tsConfigRead.then(v => v.fileAttributes);
    }

    get outputDir(): BPromise<FilePath> {
        return this.tsConfigContents.then(tsConfigJson => {
            const compilerOptions = tsConfigJson.compilerOptions || {};
            // outDir and outputFile from tsconfig, main from package.json
            const outputFile = compilerOptions.outFile || compilerOptions.out;
            const outputFileDir = outputFile && FileOps.directoryName(outputFile);
            const outputDir = compilerOptions.outDir;
            return outputDir || outputFileDir || ".";
        });
    }

    mergedTsconfigContents(compileCheckOnly = false): BPromise<ITsConfigObject> {
        return BPromise.all([this.outputDir, this.typingsDir, this.tsConfigContents]).then(
            ([outDir, typingsDir, originalTsConfig]) => {
                const emitConfig = compileCheckOnly
                    ? {
                          emitDeclarationOnly: true,
                          noEmit:
                              originalTsConfig.compilerOptions &&
                              originalTsConfig.compilerOptions.noEmit,
                      }
                    : { noEmit: true };

                const generatedValues: ITsConfigObject = {
                    exclude: [outDir],
                    compilerOptions: {
                        declaration: true,
                        declarationDir: typingsDir,
                        // Override noEmitOnError -- we shouldnt publish typings that are going
                        // to fail
                        noEmitOnError: true,
                        ...emitConfig,
                    },
                };

                const mergeWithStrategy = merge.strategy({
                    "compilerOptions.declaration": "replace",
                    "compilerOptions.emitDeclarationOnly": "replace",
                    "compilerOptions.declarationDir": "replace",
                    "compilerOptions.noEmitOnError": "replace",
                    "compilerOptions.noEmit": "replace",
                });

                const mergedContents: ITsConfigObject = mergeWithStrategy(
                    originalTsConfig as any,
                    generatedValues as any
                ) as any;

                return this.omitTsConfigOptsByVersion(mergedContents);
            }
        );
    }

    omitTsConfigOptsByVersion(tsconfigContents: ITsConfigObject) {
        const tsConfigCopy = { ...tsconfigContents };
        if (parseFloat(this.tsVersion) < parseFloat(TYPESCRIPT_MINIMUM_DECLARATION_MAP_VERSION)) {
            const omitKeys = ["declarationMap"];
            console.log(
                `Omitting the following keys because they are not compatible with ` +
                    `TS version ${this.tsVersion}: ${omitKeys.join(", ")}`
            );
            omitKeys.forEach(omitKey => {
                delete tsConfigCopy.compilerOptions[omitKey];
            });
        }

        return tsConfigCopy;
    }
}
