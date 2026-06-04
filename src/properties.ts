import type { KairoAddonProperties } from "@kairo-js/router";

export const properties: KairoAddonProperties = {
    id: "werewolf-gamemanager", //# // a-z & 0-9 - _
    metadata: {
        authors: ["shizuku86"],
    },
    header: {
        name: "Werewolf GameManager",
        description: "functions as the central GameManager for the Werewolf game.",
        version: {
            major: 1,
            minor: 1,
            patch: 0,
            prerelease: "dev.2",
            // build: "abc123",
        },
        min_engine_version: [1, 21, 132],
    },
    dependencies: [
        {
            module_name: "@minecraft/server",
            version: "2.7.0",
        },
        {
            module_name: "@minecraft/server-ui",
            version: "2.0.0",
        },
    ],
    /** 蜑肴署繧｢繝峨が繝ｳ */
    requiredAddons: {
        /**
         * id: version (string) // "kairo": "1.0.0"
         */
        kairo: "1.0.0-dev.1",
        "kairo-datavault": "1.0.0-dev.1",
    },
    tags: ["official", "stable"],
};
