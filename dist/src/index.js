import spawn from "cross-spawn";
import log from "loglevel";
import fs from "node:fs";
import tmp from "tmp";
/**
 * A mapping from language IDs to language names.
 * All the language ids/names values/types derives from this constant.
 */
export const LanguageIdToLanguage = {
    cpp: "cpp",
    cs: "csharp",
    go: "go",
    java: "java",
    js: "javascript",
    py: "python",
    rb: "ruby",
    swift: "swift",
    actions: "actions",
};
/** Full names of languages currently supported by CodeQL. */
export const SupportedLanguages = Object.values(LanguageIdToLanguage);
/** Short IDs of languages currently supported by CodeQL. */
export const SupportedLanguageIds = Object.keys(LanguageIdToLanguage);
/** A mapping from language names to language IDs. */
export const LanguageToLanguageId = Object.fromEntries(Object.entries(LanguageIdToLanguage).map(([id, language]) => [
    language,
    id,
]));
/**
 * Check if a (full) language name, such as `javascript`, is supported by CodeQL.
 */
export function isSupportedLanguage(language) {
    return SupportedLanguages.includes(language);
}
/**
 * Check if a (short) language ID, such as `js`, is supported by CodeQL.
 */
export function isSupportedLanguageId(id) {
    return SupportedLanguageIds.includes(id);
}
/**
 * Infer the language from a query ID if possible.
 *
 * This functions checks whether the query ID starts with a supported language
 * ID followed by a slash, and if so returns the corresponding language name.
 * Otherwise, it returns `undefined`.
 */
export function languageFromQueryId(queryId) {
    const [langId] = queryId.split("/");
    if (isSupportedLanguageId(langId)) {
        return LanguageIdToLanguage[langId];
    }
}
/**
 * A wrapper for interacting with the CodeQL CLI, with fixed versions of the
 * CLI and query packs.
 */
export class CodeQL {
    packVersions;
    /**
     * A cache mapping query IDs to `.ql` file paths.
     */
    resolvedQueries = new Map();
    /**
     * Create a new CodeQL CLI wrapper.
     * @param codeQlVersion The version of the CodeQL CLI to use. E.g. `2.9.0`.
     * @param packVersions A mapping from query pack names to versions. E.g. `codeql/javascript-queries` to `1.1.2`.
     */
    constructor(codeQlVersion, packVersions) {
        this.packVersions = packVersions;
        CodeQL.ensureCliVersion(codeQlVersion);
    }
    static ensureGhCliInstalled() {
        try {
            const version = this.gh(["--version"], {
                stdio: ["ignore", "pipe", "ignore"],
            });
            log.debug(`Found gh CLI version ${version}`);
        }
        catch {
            throw new Error(`Cannot find gh CLI.`);
        }
    }
    static ensureGhCliExtensionInstalled() {
        this.ensureGhCliInstalled();
        log.debug("Ensuring gh CLI extension for CodeQL is installed");
        const availableExtensions = this.gh(["extensions", "list"], {
            stdio: ["ignore", "pipe", "ignore"],
        });
        if (availableExtensions.includes("github/gh-codeql")) {
            log.debug("gh CLI extension for CodeQL is already installed");
        }
        else {
            log.debug("Installing gh CLI extension for CodeQL");
            this.gh(["extensions", "install", "github/gh-codeql"], {
                stdio: "pipe",
            });
        }
    }
    /** Simple wrapper around `spawn` for running the GitHub CLI. */
    static gh(args, options) {
        const result = spawn.sync("gh", args, {
            ...options,
            encoding: "utf8",
        });
        if (result.error) {
            throw new Error(`Failed to execute: gh ${args.join(" ")}`, {
                cause: result.error,
            });
        }
        return result.stdout;
    }
    /** Get the version of the CodeQL CLI. */
    static getCliVersion() {
        this.ensureGhCliExtensionInstalled();
        return this.gh(["codeql", "version", "--format", "terse"], {
            stdio: ["ignore", "pipe", "inherit"],
        }).trim();
    }
    /** Check that the given CodeQL version is installed, and if not install it. */
    static ensureCliVersion(version) {
        const curVersion = this.getCliVersion();
        if (curVersion !== version) {
            log.debug(`Expected CodeQL version ${version}, got ${curVersion}. Trying to install it.`);
            this.gh(["codeql", "set-channel", "release"], {});
            this.gh(["codeql", "set-version", version], {});
            if (this.getCliVersion() !== version) {
                throw new Error(`Failed to install CodeQL version ${version}`);
            }
        }
    }
    /**
     * Gets the name of the default query pack for the given language.
     */
    static getDefaultQueryPackName(language) {
        return `codeql/${language}-queries`;
    }
    /**
     * Gets the version of the default query pack to use for the given language.
     */
    getDefaultQueryPackVersion(language) {
        const defaultQueryPackName = CodeQL.getDefaultQueryPackName(language);
        if (defaultQueryPackName in this.packVersions) {
            return this.packVersions[defaultQueryPackName];
        }
        throw new Error(`No default query pack version found for ${language}`);
    }
    /**
     * Run a CodeQL CLI command.
     *
     * For example,
     *
     * ```
     * runCommand('database', 'create', '--language', 'cpp', '--source-root', '.', 'db')
     * ```
     *
     * will run `codeql database create --language cpp --source-root . db`.
     *
     * Buildless extraction (build mode none) is enabled for Java and C#.
     */
    runCommand(cwd, category, command, ...args) {
        log.debug(`Running codeql ${category} ${command} ${args.join(" ")}`);
        CodeQL.gh(["codeql", category, command, ...args], {
            cwd,
            stdio: ["ignore", "ignore", "inherit"],
            env: {
                ...process.env,
                // turn on buildless extraction for Java/C#
                CODEQL_EXTRACTOR_JAVA_OPTION_BUILDLESS: "true",
                CODEQL_EXTRACTOR_CSHARP_OPTION_BUILDLESS: "true",
            },
        });
    }
    /**
     * Create a CodeQL database.
     * @param language The language of the database.
     * @param sourceRoot The root of the source code to analyze.
     * @param databasePath The path to the database to create. Should be an empty (or non-existent) directory.
     */
    createDatabase(language, sourceRoot, databasePath) {
        this.runCommand(sourceRoot, "database", "create", "-j0", "--language", language, "--source-root", sourceRoot, databasePath);
    }
    /**
     * Run one or more CodeQL queries against a database and export the results as SARIF.
     */
    analyzeDatabase(databasePath, output, ...queries) {
        this.runCommand(databasePath, "database", "analyze", databasePath, "-j0", "--download", "--format=sarif-latest", "--sarif-add-query-help", "--output", output, ...queries);
    }
    /**
     * Create a `.qls` file referencing the given queries.
     */
    makeSuite(language, ...queryIds) {
        const suite = tmp.fileSync({ postfix: ".qls" });
        fs.writeFileSync(suite.fd, JSON.stringify([
            {
                queries: ".",
                from: CodeQL.getDefaultQueryPackName(language),
                version: this.getDefaultQueryPackVersion(language),
            },
            {
                include: {
                    id: queryIds,
                },
            },
        ]));
        return suite;
    }
    /** Resolve a list of query IDs to their corresponding `.ql` files. */
    resolveQueries(language, ...ids) {
        // figure out which queries we need to resolve
        const unresolved = ids.filter((id) => !this.resolvedQueries.has(id));
        if (unresolved.length > 0) {
            // create a temporary suite file
            const suite = this.makeSuite(language, ...unresolved);
            // run the resolve queries command (we can't use runCommand here because
            // resolve queries doesn't take an --output argument)
            const resolved = JSON.parse(CodeQL.gh(["codeql", "resolve", "queries", "--format=json", suite.name], {
                stdio: ["ignore", "pipe", "inherit"],
            }));
            suite.removeCallback();
            // add the resolved queries to the cache
            for (let i = 0; i < unresolved.length; i++) {
                this.resolvedQueries.set(unresolved[i], resolved[i]);
            }
        }
        return ids.map((id) => this.resolvedQueries.get(id));
    }
    /**
     * Run the file-classifier query to identify files that are not plain source
     * files (e.g., test files or generated files).
     *
     * @returns A map from file paths to the classification of the file.
     */
    classifyFiles(databasePath, language) {
        // first, we need to resolve the file-classifier query for the given language
        const [classifier] = this.resolveQueries(language, `${LanguageToLanguageId[language]}/file-classifier`);
        if (!classifier) {
            throw new Error(`Could not resolve file-classifier query for ${language}`);
        }
        // then, we run the query
        const output = tmp.fileSync({ postfix: ".bqrs" });
        this.runCommand(databasePath, "query", "run", "--threads", "-1", "--output", output.name, "--database", databasePath, classifier);
        // next, we convert the results to JSON; again.
        const json = tmp.fileSync({ postfix: ".json" });
        this.runCommand(databasePath, "bqrs", "decode", "--format", "json", "--output", json.name, output.name);
        // finally, we read the results
        const results = JSON.parse(fs.readFileSync(json.name, "utf8"));
        output.removeCallback();
        json.removeCallback();
        // and return the interesting bits
        return new Map(results["#select"].tuples.map((tuple) => [tuple[0].label, tuple[1]]));
    }
}
//# sourceMappingURL=index.js.map