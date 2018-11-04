import BPromise from "bluebird";
import { ConsumingTsProject } from "./ConsumingTsProject";
import { FileOps } from "./FileOps";
import { DEFAULT_TYPESCRIPT_VERSIONS } from "./TsVersions";

function main() {
    return BPromise.resolve()
        .then(() => DEFAULT_TYPESCRIPT_VERSIONS.map(tsVersion => new ConsumingTsProject(tsVersion)))
        .mapSeries(project => FileOps.remove(project.tsConfig.typingsDir).then(() => project))
        .mapSeries(project =>
            project.compileDeclarations().then(() => project.appendTypesVersionsToPackageJson())
        );
}

main();
