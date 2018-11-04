import { FileOps } from "./FileOps";
import { ShellOps } from "./ShellOps";

export class TsBin {
    constructor(readonly tsVersion: string, readonly packageRoot: string) {}
    get tsBinPath() {
        return FileOps.join(
            [this.packageRoot, "node_modules", `typescript-${this.tsVersion}`, "bin", "tsc"],
            true
        );
    }

    execute(args: string[] = []) {
        return ShellOps.exec(`${this.tsBinPath} ${args.join(" ")}`)
            .then((stdOut: string, stdErr: string) => {
                console.log(`Executed version: ${this.tsVersion} (${this.tsBinPath})`);
                console.log(`Executed stdout: ${stdOut}`);
                console.log(`Executed stdout: ${stdErr}`);
                return true;
            })
            .catch((err: Error) => {
                console.log("ERROR: ", err);
                throw err;
            });
    }
}
