var webpack = require('webpack');

var config = {
    entry: "./index.js",
    output: {
        path: "./build",
        filename: "app.js"
    },
    resolve: {
        extensions: ['', '.webpack.js', '.js']
    },
    module: {
        loaders: [
            {
                test: /\.js?$/,
                exclude: /node_modules/,
                loader: 'babel',
                query: {
                    presets: ['es2015']
                }
            }
        ]
    },
};

module.exports = config;