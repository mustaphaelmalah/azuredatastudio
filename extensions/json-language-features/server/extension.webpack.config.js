/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../../shared.webpack.config');
const path = require('path');
const webpack = require('webpack');

const config = withDefaults({
	context: path.join(__dirname),
	entry: {
		extension: './src/jsonServerMain.ts',
	},
	output: {
		filename: 'jsonServerMain.js',
		path: path.join(__dirname, 'dist')
	}
});

// add plugin, don't replace inherited
config.plugins.push(new webpack.IgnorePlugin(/vertx/)); // request-light dependency

module.exports = config;
