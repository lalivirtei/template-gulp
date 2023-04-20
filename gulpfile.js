const {src, dest, watch, parallel, series} = require('gulp');
const pug = require('gulp-pug');
const sass = require('gulp-sass')(require('sass'));
const postCSS = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const bs = require('browser-sync').create();
const webpack = require('webpack');
const webpackStream = require('webpack-stream');
const concat = require('gulp-concat');
const TerserPlugin = require('terser-webpack-plugin');
const imagemin = require('gulp-imagemin');
// const changed = require('gulp-changed');
const sourcemaps = require('gulp-sourcemaps');
const fs = require('fs');

function browserSync() {
    bs.init({
        server: {
            baseDir: 'public',
        },
        notify: false
    });
}

function layout() {
    return src(['source/index.pug'])
        .pipe(pug())
        .pipe(dest('public'))
        .pipe(bs.stream())
}

function styles() {
    // noinspection JSCheckFunctionSignatures
    return src('source/main.scss')
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(postCSS([
            autoprefixer({grid: 'autoplace'}),
            cssnano({
                preset: [
                    'default',
                    {
                        discardComments: {removeAll: true}
                    }
                ]
            })
        ]))
        .pipe(sourcemaps.write())
        .pipe(dest('public'))
        .pipe(bs.stream())
}

function scripts() {
    return src(['source/script.js', 'source/blocks/*/index.js'])
        .pipe(sourcemaps.init())
        .pipe(webpackStream({
            mode: 'production',
            performance: {hints: false},
            module: {
                rules: [
                    {
                        test: /\.m?js$/,
                        exclude: /('node_modules')/,
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: ['@babel/preset-env'],
                                plugins: ['babel-plugin-root-import']
                            }
                        }
                    }
                ]
            },
            optimization: {
                minimize: true,
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            format: {
                                comments: false
                            }
                        },
                        extractComments: false
                    })
                ]
            }

        }, webpack).on('error', () => this.emit('end')))
        .pipe(concat('script.min.js'))
        .pipe(sourcemaps.write())
        .pipe(dest('public'))
        .pipe(bs.stream())
}

function images() {
    return src('source/images/*')
        // .pipe(changed('source/images'))
        .pipe(imagemin([
            imagemin.svgo({
                // plugins disabled to prevent svgo from empty svg sprite
                plugins: [
                    {
                        cleanupIDs: false,
                        removeUselessDefs: false
                    }
                ]
            })
        ]))
        .pipe(dest('public/images'))
        .pipe(bs.stream());
}

function moveAssets() {
    return src('./favicon/*')
        .pipe(dest('public'));
}

function watcher() {
    watch("source/**/*.scss", {usePolling: true}, styles);
    watch("source/**/*.js", {usePolling: true}, scripts);
    watch("source/**/*.pug", {usePolling: true}, layout).on('change', bs.reload);
    watch("source/images/*", {usePolling: true}, images);
}

async function createBlocks() {
    let blocks = fs.readFileSync('source/blocks.csv', 'utf-8').split(', ');
    blocks.forEach(el => {
        if(!fs.existsSync('source/blocks/' + el)) {
            fs.mkdirSync('source/blocks/' + el);
            fs.open('source/blocks/' + el + '/index.pug', 'w', function() {});
            fs.open('source/blocks/' + el + '/index.js', 'w', function() {});
            fs.open('source/blocks/' + el + '/_index.scss', 'w', function() {});
            fs.appendFile('source/blocks/_index.scss', '\n@import "' + el + '";', function() {});
        }
    })
}

exports.layout = layout;
exports.styles = styles;
exports.scripts = scripts;
exports.images = images;
exports.build = parallel(layout, styles, scripts, images, moveAssets);
exports.cb = createBlocks;

exports.browserSync = browserSync;
exports.watcher = watcher;
exports.default = series(parallel(layout, styles, scripts, images), parallel(browserSync, watcher));