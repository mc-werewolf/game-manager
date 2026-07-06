import { properties } from "../properties";

export function isDevModeEnabled(): boolean {
    return properties.header.version.prerelease === "dev"
        || ((properties.tags as readonly string[] | undefined)?.includes("dev") ?? false);
}
