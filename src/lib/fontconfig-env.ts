import path from "node:path";

// Must be imported before sharp: points fontconfig at the fonts bundled in assets/fonts,
// because hosting containers (e.g. Railway) often have no fonts installed.
process.env.FONTCONFIG_FILE ??= path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts", "fonts.conf");
