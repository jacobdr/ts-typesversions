# ts-typesversions

A library for Typescript package authors to:

-   publish multiple type declaration files using the new [typesVersions](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#version-selection-with-typesversions) feature available in Typescript 3.1
-   determine the minimum Typescript version that a package is compatible with

## Install

`yarn add -D ts-typesversions`

## Usage

There are two primary intended uses for this project:

1. As a CLI to check project compatibility with different Typescript versions
2. Programmatically as part of an npm/yarn release process

### CLI

`yarn run ts-typesversions`

This will invoke an interactive CLI where you can opt to:

1. just check compilation compatibility with different versions of Typescript
2. generate declaration files for different TS versions

For full usage instructions, run:

```bash
yarn run ts-typesversions --help
```

### As Part of a Release Step

We suggest that you add `yarn run ts-typesversions --declarations` as part of the `prepublishOnly` step of the
package publish lifecycle.

For example:

```json
{
    "scripts": {
        "prepublishOnly": "rm -rf dist && tsc && yarn run ts-typesversions --declarations"
    }
}
```

To limit the supported versions to only a subset of Typescript releases you can supply the
`--ts-versions` option.

```bash
yarn run ts-typesversions --declarations --ts-versions 3.1,3.0,2.9,2.8
```
