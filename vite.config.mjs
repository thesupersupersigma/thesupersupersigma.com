import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const page = (path) => resolve(here, "src", path);

export default defineConfig({
    root: "src",                // site source lives in src/ (public/ is src/public)

    build: {
        outDir: "../dist",      // relative to root, so this is <repo>/dist
        emptyOutDir: true,      // clear old files out of dist on every build

        // every HTML page that should exist on the live site.
        // add a line here for each new app page.
        rollupOptions: {
            input: {
                main: page("index.html"),
                notFound: page("404.html"),
                shutdown: page("shutdown.html"),
                internetExplorer: page("apps/internetExplorer/internetExplorer.html"),
                ieGithub: page("apps/internetExplorer/pages/github.html"),
                mediaPlayer: page("apps/mediaPlayer/mediaPlayer.html"),
            },
        },
    },
});
