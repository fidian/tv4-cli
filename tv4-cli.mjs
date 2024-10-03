#!/usr/bin/env node

import debugModule from "debug";
import fetch from "node-fetch";
import fs from "fs";
import { metaApplicator } from "./meta-applicator.mjs";
import { metaContent } from "./meta-content.mjs";
import { metaCore } from "./meta-core.mjs";
import { metaFormatAnnotation } from "./meta-format-annotation.mjs";
import { metaMetaData } from "./meta-meta-data.mjs";
import { metaSchema } from "./meta-schema.mjs";
import { metaUnevaluated } from "./meta-unevaluated.mjs";
import { metaValidation } from "./meta-validation.mjs";
import neodoc from "neodoc";
import { normSchema } from './norm-schema.mjs';
import path from "path";
import tv4 from "tv4";
import yaml from "yaml-js";

const debug = debugModule("tv4-cli");

function usage() {
    return `Verify data using JSON Schemas and tv4.

Without data files, this will verify that your schema file is correct.
With data files, this verifies both the schema and all data files.

Files can be JSON or YAML.

Usage: tv4-cli [options] --schema=FILE_OR_URL [DATA_FILE_OR_URL...]

Options:
    --ban         Ban unknown properties during validation.
    --help        Show this help message.

Environment variables:
    Set 'DEBUG=*' to see debugging information.

Return codes:
    0     Everything went well.
    1     Could not load schema file.
    2     Could not load data file.
    3     Schema file did not validate.
    4     Data did not validate.`;
}

function isUrl(pathOrUrl) {
    return pathOrUrl.indexOf("://") > -1;
}

function resolve(pathOrUrl) {
    if (isUrl(pathOrUrl)) {
        return pathOrUrl;
    }

    return path.resolve(pathOrUrl);
}

function loadFile(pathOrUrl) {
    if (isUrl(pathOrUrl)) {
        debug(`Downloading: ${pathOrUrl}`);

        return fetch(pathOrUrl).then((data) => yaml.load(data.toString()));
    }

    debug(`Reading: ${pathOrUrl}`);

    return fs.promises
        .readFile(pathOrUrl)
        .then((data) => yaml.load(data.toString()));
}

function addSchema(schema, data) {
    debug(`Adding schema: ${schema}`);
    tv4.addSchema(schema, data);
}

function verify(schema, data, ban) {
    // Set checkRecursive=true to safely handle recursive objects, which can be created by YAML
    const result = tv4.validateResult(data, tv4.getSchema(schema), true, ban);

    if (!result || !result.error) {
        return null;
    }

    return `${result.error.message} in path "${result.error.dataPath}".`;
}

function loadMetaSchemas() {
    debug("Loading meta schemas");

    for (const data of [
        metaApplicator,
        metaContent,
        metaCore,
        metaFormatAnnotation,
        metaMetaData,
        metaSchema,
        metaUnevaluated,
        metaValidation
    ]) {
        addSchema(data.$id, data);
    }

    const missing = tv4.getMissingUris();

    if (missing.length) {
        const err = new Error(
            `Missing a referenced meta schema: ${missing.join(", ")}`
        );
        err.code = 1;

        throw err;
    }

    return Promise.resolve();
}

function loadSchema(schema) {
    const addedSchemas = [];

    return loadFile(schema)
        .then((data) => {
            normSchema(data, schema);
            addedSchemas.push(schema);
            addSchema(schema, data);

            const missing = tv4.getMissingUris();

            if (missing.length) {
                return loadSchema(missing[0]);
            }
        })
        .then(() => addedSchemas);
}

function loadSchemas(schemaUnresolved, ban) {
    const schema = resolve(schemaUnresolved);
    debug(`Loading user schema: ${schema}`);

    return loadSchema(schema).then(
        (schemaList) => {
            debug("Schema and any referenced schemas are loaded");

            for (const loadedSchema of schemaList) {
                debug(`Validating schema: ${loadedSchema}`);
                const result = verify(
                    metaSchema.$id,
                    tv4.getSchema(loadedSchema),
                    ban
                );

                if (result) {
                    const err = new Error(
                        `Validation of schema failed: ${result}`
                    );
                    err.code = 3;

                    throw err;
                }
            }

            debug("Schemas validated");
        },
        (err) => {
            err.code = 1;

            throw err;
        }
    );
}

function handleDataFiles(schema, dataFiles, ban) {
    let p = Promise.resolve();

    debug(`Handling data files`);

    for (const dataFile of dataFiles) {
        p = p
            .then(() => {
                debug(`Processing data file: ${dataFile}`);

                return loadFile(dataFile);
            })
            .then((data) => {
                const result = verify(resolve(schema), data, ban);

                if (result) {
                    const err = new Error(
                        `Validation of data failed: ${result}`
                    );
                    err.code = 4;

                    throw err;
                }

                debug(`Verified: ${dataFile}`);
            });
    }

    return p;
}

function done() {
    debug("Success");
}

const args = neodoc.run(usage(), {
    laxPlacement: true
});

debug("Arguments parsed");
const schema = args["--schema"];
const dataFiles = args.DATA_FILE_OR_URL || [];
const ban = !!args["--ban"];

loadMetaSchemas()
    .then(() => loadSchemas(schema, ban))
    .then(() => handleDataFiles(schema, dataFiles, ban))
    .then(
        () => done,
        (err) => {
            console.error(err.toString());

            if (err.stack) {
                debug(err.stack);
            }

            process.exit(err.code);
        }
    );
