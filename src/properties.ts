import type { AddonProperties } from "@kairo-js/properties";

export const properties: AddonProperties = {
    id: "werewolf-gamemanager",
    metadata: {
        authors: ["shizuku86"],
    },
    header: {
        name: "Werewolf GameManager",
        description: "functions as the central GameManager for the Werewolf game.",
        version: {
            major: 0,
            minor: 1,
            patch: 0,
        },
        min_engine_version: { major: 1, minor: 21, patch: 132 },
    },
    minecraftDependencies: [
        { module_name: "@minecraft/server", version: "2.8.0" },
        { module_name: "@minecraft/server-ui", version: "2.0.0" },
    ],
    dependencies: {
        kairo: "^1.0.0-beta.0",
        "kairo-database": "^1.0.0-beta.0",
    },
    tags: ["official", "stable"],
};
