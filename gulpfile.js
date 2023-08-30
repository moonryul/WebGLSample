// build setup for a web application that uses TypeScript for scripting, HTML and CSS for layout and styling, and includes asset files
//Navigate to the project root directory.
// Run npm install to install the required Node.js packages based on the package.json file.
// Run gulp default to execute the default build process, which bundles TypeScript files, copies HTML, shader, and asset files, and outputs the result to the dist folder.
// Run gulp run-server to start the development server. You can access the project in your web browser at http://localhost:8001.

//// Use browserify to bundle TypeScript files (mainly src/scripts/main.ts) into a single JavaScript file (bundle.js).
  //  It gathers all the imported modules and their dependencies. Then, it bundles all these modules 
  //  into a single JavaScript file, often named bundle.js. 
  //  This file contains all the code required for your application to run in the browser.
  // By bundling your TypeScript code using Browserify, you create a single JavaScript file that can be included in your HTML page. This simplifies the deployment 
  // and distribution of your application and ensures that all the necessary code is available in a single file.

// // "Browserify," which implies the process of making something suitable for or compatible with a web browser.
var gulp = require("gulp");
var browserify = require("browserify");
var source = require('vinyl-source-stream');
var tsify = require("tsify");
var connect = require('gulp-connect');

var respurces = {
  htmls: [
    'htmls/*.html',
    'styles/*.css'
  ],
  assets: [
    'assets/*.*'
  ],
  shaders: [
    'src/shaders/**/*.*'
  ],
  scripts: [
    'src/js/*.js'
  ]
};

gulp.task("copy-htmls", function () {
  return gulp.src(respurces.htmls)
    .pipe(gulp.dest("dist"));
});

gulp.task("copy-shaders", function () {
  return gulp.src(respurces.shaders)
    .pipe(gulp.dest("dist/assets/shaders"));
});

gulp.task("copy-assets", function () {
  return gulp.src(respurces.assets)
    .pipe(gulp.dest("dist/assets"));
});

gulp.task("default", ["copy-htmls", "copy-shaders", "copy-assets"], function () {  
  return browserify({ 
    basedir: '.',
    debug: true,
    entries: ['src/scripts/main.ts'],
    cache: {},
    packageCache: {}
  })
  .plugin(tsify)
  .bundle()
  .pipe(source('bundle.js'))
  .pipe(gulp.dest("dist"));
});

gulp.task('run-server', function() {
  var options = {
    root: './dist',
    port: 8001
  };
  connect.server(options);
});