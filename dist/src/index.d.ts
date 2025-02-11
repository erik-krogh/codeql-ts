import tmp from "tmp";
/**
 * A mapping from language IDs to language names.
 * All the language ids/names values/types derives from this constant.
 */
export declare const LanguageIdToLanguage: {
    readonly cpp: "cpp";
    readonly cs: "csharp";
    readonly go: "go";
    readonly java: "java";
    readonly js: "javascript";
    readonly py: "python";
    readonly rb: "ruby";
    readonly swift: "swift";
    readonly actions: "actions";
};
/** The full names of languages currently supported by CodeQL. */
export type Language = (typeof LanguageIdToLanguage)[LanguageId];
/** The short IDs of languages currently supported by CodeQL. */
export type LanguageId = keyof typeof LanguageIdToLanguage;
/** Full names of languages currently supported by CodeQL. */
export declare const SupportedLanguages: Language[];
/** Short IDs of languages currently supported by CodeQL. */
export declare const SupportedLanguageIds: LanguageId[];
/** A mapping from language names to language IDs. */
export declare const LanguageToLanguageId: Record<Language, LanguageId>;
/**
 * Check if a (full) language name, such as `javascript`, is supported by CodeQL.
 */
export declare function isSupportedLanguage(language: string): language is Language;
/**
 * Check if a (short) language ID, such as `js`, is supported by CodeQL.
 */
export declare function isSupportedLanguageId(id: string): id is LanguageId;
/**
 * Infer the language from a query ID if possible.
 *
 * This functions checks whether the query ID starts with a supported language
 * ID followed by a slash, and if so returns the corresponding language name.
 * Otherwise, it returns `undefined`.
 */
export declare function languageFromQueryId(queryId: string): Language | undefined;
/**
 * A wrapper for interacting with the CodeQL CLI, with fixed versions of the
 * CLI and query packs.
 */
export declare class CodeQL {
    private readonly packVersions;
    private readonly timeout;
    /**
     * A cache mapping query IDs to `.ql` file paths.
     */
    private resolvedQueries;
    /**
     * Create a new CodeQL CLI wrapper.
     * @param codeQlVersion The version of the CodeQL CLI to use. E.g. `2.9.0`.
     * @param packVersions A mapping from query pack names to versions. E.g. `codeql/javascript-queries` to `1.1.2`.
     * @param timeout The maximum time to wait for the command to execute, in milliseconds. Defaults to -1, which indicates no timeout.
     */
    static make(codeQlVersion: string, packVersions: Record<string, string>, timeout?: number): Promise<CodeQL>;
    /**
     * Create a new CodeQL CLI wrapper.
     * @param packVersions A mapping from query pack names to versions. E.g. `codeql/javascript-queries` to `1.1.2`.
     * @param timeout The maximum time to wait for the command to execute, in milliseconds. Defaults to -1, which indicates no timeout.
     */
    private constructor();
    private ensureGhCliInstalled;
    private ensureGhCliExtensionInstalled;
    /** Simple wrapper around `spawn` for running the GitHub CLI. */
    private gh;
    /** Get the version of the CodeQL CLI. */
    private getCliVersion;
    /** Check that the given CodeQL version is installed, and if not install it. */
    private ensureCliVersion;
    /**
     * Gets the name of the default query pack for the given language.
     */
    static getDefaultQueryPackName(language: Language): string;
    /**
     * Gets the version of the default query pack to use for the given language.
     */
    private getDefaultQueryPackVersion;
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
    runCommand(cwd: string, category: string, command: string, ...args: string[]): Promise<void>;
    /**
     * Create a CodeQL database.
     * @param language The language of the database.
     * @param sourceRoot The root of the source code to analyze.
     * @param databasePath The path to the database to create. Should be an empty (or non-existent) directory.
     */
    createDatabase(language: Language, sourceRoot: string, databasePath: string): Promise<void>;
    /**
     * Run one or more CodeQL queries against a database and export the results as SARIF.
     */
    analyzeDatabase(databasePath: string, output: string, ...queries: string[]): Promise<void>;
    /**
     * Create a `.qls` file referencing the given queries.
     */
    makeSuite(language: Language, ...queryIds: string[]): tmp.FileResult;
    /** Resolve a list of query IDs to their corresponding `.ql` files. */
    private resolveQueries;
    /**
     * Run the file-classifier query to identify files that are not plain source
     * files (e.g., test files or generated files).
     *
     * @returns A map from file paths to the classification of the file.
     */
    classifyFiles(databasePath: string, language: Language): Promise<Map<string, string>>;
}
