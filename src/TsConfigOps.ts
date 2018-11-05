import BPromise from "bluebird";
import merge = require("webpack-merge");

import { CompilerOptions } from "typescript-2.9";
import { FileOps, FilePath, IReadJson } from "./FileOps";
import { ISupportedTsVersions } from "./TsVersions";
import { TupleLiteralToUnion } from "./Utils";

type IAllowedTsVersion = TupleLiteralToUnion<ISupportedTsVersions>;

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
            .map(version => ({
                [`>=${version}`]: {
                    "*": [
                        FileOps.join(
                            [outputDirectory, this.typingsDirName(tsVersionsDirPrefix, version)],
                            false
                        ),
                    ],
                },
            }))
            .reduce((prev, current) => ({ ...prev, ...current }), {});
    }

    static generateTypesSectionPath(
        packageJsonMainEntry: string | undefined,
        tsVersions: IAllowedTsVersion[],
        tsVersionsDirPrefix: string,
        outputDirectory: string
    ) {
        const lowestVersion = tsVersions.sort()[0];
        const currentPackageJsonEntryFile = packageJsonMainEntry
            ? FileOps.baseName(packageJsonMainEntry)
            : "index.js";
        const entryDeclarationName = currentPackageJsonEntryFile.replace(".js", ".d.ts");

        return FileOps.join(
            [
                outputDirectory,
                this.typingsDirName(tsVersionsDirPrefix, lowestVersion),
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
            console.log("JDR DEBUG outDir candidates: ", {
                outputFile,
                outputFileDir,
                compilerOptions,
                outputDir,
            });
            return outputDir || outputFileDir || ".";
        });
    }

    mergedTsconfigContents(tsVersionsToExclude: string[]): BPromise<ITsConfigObject> {
        return BPromise.all([this.outputDir, this.typingsDir, this.tsConfigContents]).then(
            ([outDir, typingsDir, originalTsConfig]) => {
                const formatExcludeEntry = (_tsVersion: string) =>
                    FileOps.join(
                        [outDir, TsConfig.typingsDirName(this.tsVersionsDirPrefix, _tsVersion)],
                        false
                    );

                const generatedValues: ITsConfigObject = {
                    exclude: tsVersionsToExclude.map(formatExcludeEntry),
                    compilerOptions: {
                        declaration: true,
                        emitDeclarationOnly: true,
                        declarationDir: typingsDir,
                        // Override noEmitOnError -- we shouldnt publish typings that are going
                        // to fail
                        noEmitOnError: true,
                    },
                };

                const mergeWithStrategy = merge.strategy({
                    "compilerOptions.declaration": "replace",
                    "compilerOptions.emitDeclarationOnly": "replace",
                    "compilerOptions.declarationDir": "replace",
                    "compilerOptions.noEmitOnError": "replace",
                });
                const mergedContents: ITsConfigObject = mergeWithStrategy(
                    originalTsConfig as any,
                    generatedValues as any
                ) as any;

                return mergedContents;
            }
        );
    }
}
