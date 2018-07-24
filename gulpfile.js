var fs = require("fs");
var path = require("path");

var browserSync = require("browser-sync");
var debounce = require("debounce");
var gulp = require("gulp");
var gulp_util = require("gulp-util");
var gulp_watch = require("gulp-watch");
var less = require("less");
var through2 = require("through2");

var DIRNAME = __dirname;

// #region Logging

function logDest(prefix /* = "->" */) {
	return through2.obj(function(file, enc, cb) {
		logFilename(file.path, prefix);
		this.push(file);
		cb();
	});
}

function log() {
	gulp_util.log.apply(gulp_util, arguments);
}

function logError(error) {
	var message = error.messageFormatted || error.message;
	log(message);
}

function logFilename(filename, prefix /* = "->" */) {
	log((prefix ? prefix + " " : "-> ") + filename);
}

// #endregion

// #region Stream helpers

function prepStream(s /* : stream */) {
	return s.on("error", handleError);
}

function handleError(error) {
	logError(error);
	this.end();
}

// #endregion

// #region Less compiler

class LessCompiler {

	constructor(sourceFilename, targetFilename) {
		this._sourceFilename = sourceFilename;
		this._targetFilename = targetFilename;
		this._clear();
	}

	compile() {
		if (this._promise) {
			if (!this._planned) {
				this._promise.then(() => this._compile());
				this._planned = true;
			}
		}
		else
			this._compile();
	}

	_compile() {
		log("-- Running less");

		this._promise = new Promise((resolve, reject) => {
			fs.readFile(this._sourceFilename, 'utf-8', (err, lessContent) => {
				if (err) {
					logError(err);
					this._clear();
					resolve();
					return;
				}
				less.render(lessContent).then(
					({ css, map }) => {
						if (err) {
							logError(err);
							this._clear();
							resolve();
							return;
						}
						fs.writeFile(this._targetFilename, css, (err) => {
							if (err)
								logError(err);
							this._clear();
							resolve();
						});
					},
					err => {
						if (err)
							logError(err);
					});
			});
		});
	}

	_clear() {
		this._promise = null;
		this._planned = false;
	}
}

var lessCompiler = new LessCompiler(
	/* sourceFilename = */ path.join(DIRNAME, "style.less"),
	/* targetFilename = */ path.join(DIRNAME, "style.css"));

// #endregion

var DEBOUNCE_TIMEOUT = 1000;

gulp.task("default", function(callback) {

	// compile less at start
	lessCompiler.compile();

	bs = browserSync.create();
	bs.init({
		// https://browsersync.io/docs/options
		port: 3004,
		server: ".",
		reloadDelay: DEBOUNCE_TIMEOUT,
	});

	var less = gulp.watch(["**/*.less"]);
	less.on("change", debounce(() => lessCompiler.compile(), DEBOUNCE_TIMEOUT));

	gulp_watch(["index.html", "**/*.css"])
		.pipe(bs.stream())
		.pipe(prepStream(logDest("**")));

	// `callback` is never called
});
