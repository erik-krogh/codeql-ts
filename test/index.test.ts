import { expect } from "chai";
import { CodeQL } from "../src/index.js";

import path from "node:path";
import { fileURLToPath } from "node:url";
import tmp from "tmp";
import type sarif from "sarif";
import * as fs from "fs/promises";

const source = path.dirname(fileURLToPath(new URL(import.meta.url)));
/** the root path to this repo */
const root = path.resolve(source, "..");

describe("the codeql TS wrapper", function () {
  // 5 minutes should be way too much, but I want to be sure.
  this.timeout(5 * 60 * 1000);

  it("should work", async function () {
    console.log("Initializing CodeQL with version 2.20.0.");
    const codeql = new CodeQL("2.20.0", {
      "codeql/javascript-queries": "1.2.5",
    });

    // Checking if the CodeQL instance is created successfully.
    expect(codeql).to.be.an.instanceOf(CodeQL);

    // Creating a temporary directory for the database.
    const dir = tmp.dirSync({ unsafeCleanup: true });

    console.log("Creating a database of the current repository.");
    codeql.createDatabase("javascript", root, dir.name);

    console.log("Resolving queries for JavaScript.");
    const suite = codeql.makeSuite("javascript", "js/xss", "js/path-injection");

    // Setting up a temporary path to store the results.
    const resultsPath = path.join(dir.name, "results.sarif");

    console.log("Running the queries on the database.");
    codeql.analyzeDatabase(dir.name, resultsPath, suite.name);

    // Reading and parsing the results from the SARIF file."
    const results = JSON.parse(
      await fs.readFile(resultsPath, "utf-8"),
    ) as sarif.Log;

    // Expecting no results from the analysis.
    expect(results.runs[0].results).to.have.length(0);

    console.log("classify files");
    const classification = codeql.classifyFiles(dir.name, "javascript");

    // map to object
    const clasObj = Object.fromEntries(classification);

    // Expecting this file to be a test file.
    expect(clasObj).to.have.property(
      path.join(root, "test", "index.test.ts"),
      "test",
    );

    // Cleaning up the temporary directory.
    dir.removeCallback();
    suite.removeCallback();
  });
});
