declare module "strip-json-comments";

declare module "jsonfile" {
    import Promise from "bluebird";
    export function readFile(name: string): Promise<{}>;
    export function writeFile(path: string, payload: {}, options?: {}): Promise<void>;
}

declare module "detect-indent" {
    function main(...args: any[]): any;
    export = main;
}

declare module "*package.json" {
    const value: any;
    export const version: string;
    export default value;
}
