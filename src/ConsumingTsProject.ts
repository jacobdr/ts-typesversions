import BPromise from "bluebird";
import { FileOps } from "./FileOps";
import { TsBin } from "./TsBin";
import { ITypesVersionsSection, TsConfig } from "./TsConfigOps";
import { DEFAULT_TYPESCRIPT_VERSIONS, ISupportedTsVersions } from "./TsVersions";
import { TupleLiteralToUnion } from "./Utils";

// This assumes a structure like CONSUMER_PROJ/node_modules/ts-typesversions/dist/THIS_FILE, where
// __dirname is dist
const CONSUMING_PROJECT_ROOT = FileOps.join([__dirname, "..", "..", ".."], true);

export interface IPackageJsonWithTypesVersions {
    [TsConfig.TYPES_VERSIONS_KEY]: ITypesVersionsSection;
}

export class ConsumingTsProject {
    readonly tsBin: TsBin;
    readonly tsConfig: TsConfig;

    constructor(
        readonly tsVersion: TupleLiteralToUnion<ISupportedTsVersions>,
        readonly projectRoot: string = CONSUMING_PROJECT_ROOT,
        readonly tsConfigFilePath: string = FileOps.join([projectRoot, "tsconfig.json"], true),
        readonly tsVersions = DEFAULT_TYPESCRIPT_VERSIONS
    ) {
        this.tsBin = new TsBin(tsVersion, projectRoot);
        this.tsConfig = new TsConfig(tsConfigFilePath, tsVersion);
    }

    get packageJsonPath() {
        return FileOps.join([this.projectRoot, "package.json"], true);
    }

    appendTypesVersionsToPackageJson(
        tsVersions = this.tsVersions,
        performWrite = true
    ): BPromise<IPackageJsonWithTypesVersions> {
        return BPromise.all([FileOps.readJson(this.packageJsonPath), this.tsConfig.outputDir])
            .then(([packageJson, outputDir]) => {
                const packageJsonContents = packageJson.contents;
                const typesVersionsContents = TsConfig.generateTypesVersionsSection(
                    tsVersions,
                    this.tsConfig.tsVersionsDirPrefix,
                    outputDir
                );

                return {
                    jsonContents: {
                        ...packageJsonContents,
                        [TsConfig.TYPES_VERSIONS_KEY]: typesVersionsContents,
                    },
                    fileAttributes: packageJson.fileAttributes,
                };
            })
            .then(
                ({ jsonContents, fileAttributes }) =>
                    performWrite
                        ? FileOps.writeJsonFile(this.packageJsonPath, jsonContents, {
                              spaces: fileAttributes.amount,
                          })
                        : jsonContents
            );
    }

    compileDeclarations(removeTempFile = false) {
        return this.writeTempTsconfig(this.tsBin.packageRoot).then(writeResult => {
            console.log("JDR DEBUG newTsConfigFilePath: ", writeResult.filePath);
            return this.tsBin
                .execute(["--project", `${writeResult.filePath}`])
                .then(removeTempFile ? FileOps.remove(writeResult.filePath) : writeResult.filePath);
        });
    }

    writeTempTsconfig(
        projectDirectory: string,
        tempTsConfigPathForVersion = `tsconfig.${this.tsVersion}.json`,
        tsVersions = this.tsVersions
    ) {
        return this.tsConfig.mergedTsconfigContents(tsVersions).then(mergedTsConfigContents => {
            const newTsConfigFilePath = FileOps.join(
                [projectDirectory, tempTsConfigPathForVersion],
                true
            );
            return {
                contents: FileOps.writeJsonFile(newTsConfigFilePath, mergedTsConfigContents),
                filePath: newTsConfigFilePath,
            };
        });
    }
}
