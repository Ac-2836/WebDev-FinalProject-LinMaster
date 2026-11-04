const ignores = require('./eslint.ignores.js');

module.exports = [{ignores}, ...require('gts')];
