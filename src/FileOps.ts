import BPromise from "bluebird";
import detectIndent = require("detect-indent");
import { readFile } from "fs";
import * as jsonfile from "jsonfile";
import * as path from "path";
import stripJsonComments from "strip-json-comments";

import { ShellOps } from "./ShellOps";

const _readFileAsync: (...args: any[]) => BPromise<{}> = BPromise.promisify(readFile);

export type FilePath = string;

export interface IFileAttributes {
    amount: number;
    type: string | null;
    indent: string;
}

export interface IReadJson<T> {
    contents: T;
    fileAttributes: IFileAttributes;
}

export class FileOps {
    static readFile = _readFileAsync;

    static readJson<T = {}>(filename: string, stripWhiteSpace = true): BPromise<IReadJson<T>> {
        return this.readFile(filename, { encoding: "utf8" }).then(contents => {
            const stippedJson = stripJsonComments(contents, { whitespace: stripWhiteSpace });
            const parsedJson = JSON.parse(stippedJson);
            const fileAttributes = detectIndent(contents);
            return { fileAttributes, contents: parsedJson };
        });
    }

    static directoryName(filePath: string): FilePath {
        return path.dirname(filePath);
    }

    static baseName(filePath: string): FilePath {
        return path.basename(filePath);
    }

    static join(portions: string[], absolute: boolean): FilePath {
        const joinedPath = path.join(...portions);
        return absolute ? path.resolve(joinedPath) : joinedPath;
    }

    static writeJsonFile<T = {}>(
        packageJsonFilePath: string,
        contents: T,
        config?: { spaces?: number; EOL?: string }
    ) {
        const _config = config || {};
        return jsonfile
            .writeFile(packageJsonFilePath, contents, {
                spaces: _config.spaces,
                EOL: _config.EOL,
            })
            .then(() => contents);
    }

    static remove(fileOrDirPath: string | BPromise<string>): BPromise<FilePath> {
        return BPromise.resolve(fileOrDirPath).then(resolvedFilePath => {
            const cmd = `rm -rf ${resolvedFilePath}`;
            return ShellOps.exec(cmd).then(() => resolvedFilePath);
        });
    }
}
