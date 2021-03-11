// Note on compiling SASS/SCSS to CSS: That happens in 'on-build-start.sh'.

const webpack = require("webpack");
const CircularDependencyPlugin = require("circular-dependency-plugin");
const WebpackShellPlugin = require("webpack-shell-plugin");
// const HtmlWebpackPlugin = require('html-webpack-plugin');

const prod = process.argv.indexOf("-p") !== -1;
const env = prod ? "prod" : "dev";

console.log("TARGET ENV: " + env);

module.exports = {
    entry: "./ts/index.tsx",

    output: {
        filename: "bundle.js",
        path: __dirname
    },

    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".tsx", ".ts", ".js", ".json"]
    },

    module: {
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            {
                test: /\.tsx?$/,
                loader: "awesome-typescript-loader",

                // NOTE: for webpack 5 I think this should be "options", instead of "query"
                query: {
                    // Use this to point to your tsconfig.json.
                    configFileName: "./tsconfig." + env + ".json"
                }
            },

            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            },

            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"]
            },

            {
                test: /\.htm$/,
                use: ["html-loader"]
            }
        ]
    },

    plugins: [
        new WebpackShellPlugin({
            onBuildStart: ["./on-build-start.sh"]
            // onBuildEnd: ['whatever else']
        }),
        new CircularDependencyPlugin({
            // `onDetected` is called for each module that is cyclical
            onDetected({ module: webpackModuleRecord, paths, compilation }) {
                // `paths` will be an Array of the relative module paths that make up the cycle
                // `module` will be the module record generated by webpack that caused the cycle
                var fullPath = paths.join(" -> ");
                if (fullPath.indexOf("node_modules") === -1) {
                    compilation.errors.push(new Error("CIRC. REF: " + fullPath));
                }
            }
        })
    ]
};
