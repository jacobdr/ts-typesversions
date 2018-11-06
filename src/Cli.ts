#!/usr/bin/env node
import BPromise from "bluebird";
import commander = require("commander");
import inquirer = require("inquirer");
import "source-map-support/register";

import packageJson from "../package.json";
import { ConsumingTsProject } from "./ConsumingTsProject";
import { FileOps } from "./FileOps";
import { DEFAULT_TYPESCRIPT_VERSIONS, IAllowedTsVersion } from "./TsVersions";

const tsVersionNames = DEFAULT_TYPESCRIPT_VERSIONS.map(v => ({ name: v }));

function stringToArray(input: string) {
    return input.split(",");
}

interface IMain {
    tsVersions?: IAllowedTsVersion[];
    declarations?: boolean;
    compatibilityCheck?: boolean;
    debug?: boolean;
}

function main(config: IMain) {
    const typescriptVersions = config.tsVersions || DEFAULT_TYPESCRIPT_VERSIONS;
    const generateDeclarations = "declarations" in config ? config.declarations : true;
    const compatibilityCheckOnly = generateDeclarations && !!config.compatibilityCheck;
    const removeTempTsconfigFile = !config.debug;
    const updatePackageJsonFile = !compatibilityCheckOnly;

    return BPromise.resolve()
        .then(() => typescriptVersions.map(tsVersion => new ConsumingTsProject(tsVersion)))
        .mapSeries(project =>
            FileOps.remove(project.tsConfig.typingsDir).then(() => {
                console.log(`Starting compilation for TS version: ${project.tsConfig.tsVersion}`);
                return project
                    .compileDeclarations(removeTempTsconfigFile, compatibilityCheckOnly)
                    .then(() =>
                        project.appendTypesVersionsToPackageJson(
                            updatePackageJsonFile,
                            typescriptVersions
                        )
                    )
                    .then(() => project.tsConfig.typingsDir)
                    .then(typingsDir => {
                        const message = compatibilityCheckOnly
                            ? `Compilation succeeded`
                            : `Successfully wrote type definitions to: ${typingsDir}`;
                        console.log(message);
                    });
            })
        );
}

export const gatherUserResponses = () =>
    inquirer
        .prompt([
            {
                type: "checkbox",
                message: "Select Typescript versions to check compilation against",
                name: "--ts-versions",
                default: DEFAULT_TYPESCRIPT_VERSIONS,
                choices: [new inquirer.Separator(" = TS Versions = "), ...tsVersionNames],
                validate(answer) {
                    if (answer.length < 1) {
                        return "You must choose at least one TS Version.";
                    }
                    return true;
                },
            },
            {
                type: "list",
                message:
                    "Do you want to generate declarations or just check compilation compatibility?",
                name: "--compatibility-check",
                choices: [
                    { name: "Generate declarations", value: "" },
                    { name: "Compile only", value: "" },
                ],
            },
        ])
        .then((answers: { [key: string]: any }) => {
            const answerKeys = Object.keys(answers);
            const answersArray = answerKeys.reduce(
                (cmdArray, k) => {
                    const value = answers[k];
                    const parsedValue: string = Array.isArray(value) ? value.join(",") : value;
                    const nextArgs = [`${k}`, parsedValue];
                    return [...cmdArray, ...nextArgs];
                },
                [] as string[]
            );
            return answersArray;
        });

export const commanderApp: commander.Command = commander
    .version(packageJson.version)
    .option("-t, --ts-versions <items>", "Typescript versions to check", stringToArray)
    .option(
        "-c, --compatibility-check",
        "Only check compilation compatibility. Note: This will not generate declaration files"
    )
    .option(
        "-d, --declarations",
        `Generate declarations files for TS versions. By default, will try to compile typings ` +
            `for all default TS versions (${DEFAULT_TYPESCRIPT_VERSIONS}). \n\t\t\t\tTo limit the ` +
            `versions of TS to check, use the --ts-versions flag`
    )
    .action(main);

// https://nodejs.org/docs/latest/api/all.html#modules_accessing_the_main_module
if (require.main === module) {
    BPromise.resolve()
        .then(() => {
            // Need to get rid of the node runtime and the invocation of this script
            const slicedArgs = process.argv.slice(2);
            if (slicedArgs.length > 0) return commanderApp.parseOptions(process.argv);
            return gatherUserResponses().then(answers => {
                return commanderApp.parseOptions([...process.argv, ...answers]);
            });
        })
        .then(result => {
            const combinedArgs = [...result.args, ...result.unknown].filter(x => x !== "");
            commanderApp.parse(combinedArgs);
        });
}
