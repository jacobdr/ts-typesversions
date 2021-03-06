import BPromise from "bluebird";
import { FileOps } from "./FileOps";
import { TsBin } from "./TsBin";
import { ITsConfigObject, ITypesVersionsSection, TsConfig } from "./TsConfigOps";
import { DEFAULT_TYPESCRIPT_VERSIONS, IAllowedTsVersion } from "./TsVersions";

// This assumes a structure like CONSUMER_PROJ/node_modules/ts-typesversions/dist/THIS_FILE, where
// __dirname is dist
const CONSUMING_PROJECT_ROOT =
    process.env.CONSUMING_PROJECT_ROOT || FileOps.join([__dirname, "..", "..", ".."], true);

export interface IPackageJson {
    main?: string;
}
export interface IPackageJsonWithTypesVersions extends IPackageJson {
    [TsConfig.TYPES_VERSIONS_KEY]: ITypesVersionsSection;
    [TsConfig.TYPES_KEY]: string;
}

export class ConsumingTsProject {
    readonly tsBin: TsBin;
    readonly tsConfig: TsConfig;

    constructor(
        readonly tsVersion: IAllowedTsVersion,
        readonly projectRoot: string = CONSUMING_PROJECT_ROOT,
        readonly tsConfigFilePath: string = FileOps.join([projectRoot, "tsconfig.json"], true),
        readonly tsVersions = DEFAULT_TYPESCRIPT_VERSIONS
    ) {
        console.log(
            `Initializing project from ${CONSUMING_PROJECT_ROOT} for TS version ${this.tsVersion}`
        );
        this.tsBin = new TsBin(tsVersion, projectRoot);
        this.tsConfig = new TsConfig(tsConfigFilePath, tsVersion);
    }

    get packageJsonPath() {
        return FileOps.join([this.projectRoot, "package.json"], true);
    }

    appendTypesVersionsToPackageJson(
        modifyPackageJsonFile: boolean,
        tsVersions: IAllowedTsVersion[]
    ): BPromise<IPackageJsonWithTypesVersions> {
        return BPromise.all([
            FileOps.readJson<IPackageJson>(this.packageJsonPath),
            this.tsConfig.outputDir,
        ])
            .then(([packageJson, outputDir]) => {
                const packageJsonContents = packageJson.contents;
                const typesVersionsContents = TsConfig.generateTypesVersionsSection(
                    tsVersions,
                    this.tsConfig.tsVersionsDirPrefix,
                    outputDir
                );

                const minimumTargetedVersion = tsVersions.sort()[0];

                const legacyTypesPath = TsConfig.generateTypesSectionPath(
                    packageJson.contents.main,
                    minimumTargetedVersion,
                    this.tsConfig.tsVersionsDirPrefix,
                    outputDir
                );
                // TODO: Use webpack-merge below
                return {
                    jsonContents: {
                        ...packageJsonContents,
                        [TsConfig.TYPES_VERSIONS_KEY]: typesVersionsContents,
                        [TsConfig.TYPES_KEY]: legacyTypesPath,
                    },
                    fileAttributes: packageJson.fileAttributes,
                };
            })
            .then(
                ({ jsonContents, fileAttributes }) =>
                    modifyPackageJsonFile
                        ? FileOps.writeJsonFile(this.packageJsonPath, jsonContents, {
                              spaces: fileAttributes.amount,
                          })
                        : jsonContents
            );
    }

    compileDeclarations(removeTempFile = true, compileOnly = false) {
        return this.writeTempTsconfig(this.tsBin.packageRoot, compileOnly).then(writeResult => {
            return this.tsBin
                .execute(["--project", `${writeResult.filePath}`])
                .then(
                    () =>
                        removeTempFile ? FileOps.remove(writeResult.filePath) : writeResult.filePath
                );
        });
    }

    writeTempTsconfig(
        projectDirectory: string,
        compileOnly: boolean,
        tempTsConfigPathForVersion = `tsconfig.${this.tsVersion}.json`
    ): BPromise<{ filePath: string; contents: ITsConfigObject }> {
        return this.tsConfig.mergedTsconfigContents(compileOnly).then(mergedTsConfigContents => {
            const newTsConfigFilePath = FileOps.join(
                [projectDirectory, tempTsConfigPathForVersion],
                true
            );
            return FileOps.writeJsonFile(newTsConfigFilePath, mergedTsConfigContents).then(() => {
                return {
                    contents: mergedTsConfigContents,
                    filePath: newTsConfigFilePath,
                };
            });
        });
    }
}
