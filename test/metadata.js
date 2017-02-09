/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * *
 */
;// QUOKKA 2017
// By zibx on 2/7/17.

module.exports = (function () {
    'use strict';
    var assert = require('chai').assert;
    var tokenizer = require('../Core/Tokenizer'),
        lexer = require('../Core/Preprocess'),
        metadata = require('../Core/Metadata'),
        fs = require('fs');

    describe('Metadata', function() {

        it('extract', function () {
            var data = fs.readFileSync('test/qs/example.qs') + '',
                tokens = tokenizer(data, 'example.qs'),
                lex = lexer(tokens);
            lex.forEach(function(item){
                item.metadata = metadata(item);
            });

            console.log(lex[0].metadata)
        });
    });

})();