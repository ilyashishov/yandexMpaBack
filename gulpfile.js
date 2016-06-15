var gulp = require('gulp');
var webpack = require('webpack');

var config = require('./webpack.config.js');

gulp.task('build-backend', function(done) {
  webpack(config).run(function(err, stats) {
    if(err) {
      console.log('Error', err);
    }
    else {
      console.log(stats.toString());
    }
    done();
  });
});