#!/usr/bin/env node
import BPromise from "bluebird";
import { ConsumingTsProject } from "./ConsumingTsProject";
import { FileOps } from "./FileOps";
import { DEFAULT_TYPESCRIPT_VERSIONS } from "./TsVersions";

function main() {
    return BPromise.resolve()
        .then(() => DEFAULT_TYPESCRIPT_VERSIONS.map(tsVersion => new ConsumingTsProject(tsVersion)))
        .mapSeries(project => FileOps.remove(project.tsConfig.typingsDir).then(() => project))
        .mapSeries(project => {
            console.log(`Starting compilation for TS version: ${project.tsConfig.tsVersion}`);
            return project
                .compileDeclarations()
                .then(() => project.appendTypesVersionsToPackageJson())
                .then(() => project.tsConfig.outputDir)
                .then(outputDir =>
                    console.log(`Successfully published type definitions to: ${outputDir}`)
                );
        });
}

main();
