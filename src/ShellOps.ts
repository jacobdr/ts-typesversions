import BPromise from "bluebird";
import { exec } from "child_process";

const _execPromise: any = BPromise.promisify(exec as any, { multiArgs: true });

export class ShellOps {
    static exec = _execPromise;
}
