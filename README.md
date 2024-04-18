# on-demand-chunk-loading-webpack-plugin

[![npm version](https://badge.fury.io/js/on-demand-chunk-loading-webpack-plugin.svg)](http://badge.fury.io/js/on-demand-chunk-loading-webpack-plugin)
[![GitHub issues](https://img.shields.io/github/issues/ramirezcgn/on-demand-chunk-loading-webpack-plugin.svg)](https://github.com/ramirezcgn/on-demand-chunk-loading-webpack-plugin/issues)
[![GitHub stars](https://img.shields.io/github/stars/ramirezcgn/on-demand-chunk-loading-webpack-plugin.svg)](https://github.com/ramirezcgn/on-demand-chunk-loading-webpack-plugin/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/ramirezcgn/on-demand-chunk-loading-webpack-plugin/master/LICENSE)

A webpack plugin to load chunks on demand

## Usage

```javascript
// webpack.config.js
const OnDemandChunkLoadingPlugin = require('on-demand-chunk-loading-webpack-plugin');

plugins: [
  new OnDemandChunkLoadingPlugin(),
];
```

### Webpack compatibility

Webpack 5.x

## License

MIT
