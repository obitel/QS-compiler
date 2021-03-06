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
    var build = require('../build'),
        esprima = require('esprima'),
        escodegen = require('escodegen'),
        fs = require('fs');
    var compact = function(code){
        var f = escodegen.generate(esprima.parse('('+code+')'), {format: {
            renumber: true,
            hexadecimal: true,
            quotes: 'double',
            escapeless: true,
            compact: true,
            parentheses: false,
            semicolons: false
        }});
        var start = f.indexOf('{')+1;
        return f.substr(start, f.length - 2-start);
    };
    var compile = function(fileName, cb){
        var crafted = build({
            lib: void 0,
            source: fs.readFileSync(fileName) + ''
        }, cb);
    };

    describe('JS transformations', function() {
        it('simple inner vars declaration', function (done) {
            compile('test/qs/functions.qs', function (result) {
                var change = result.ast.main.events.s1.change[0]._js;

                assert.equal(
                    compact(change),
                    'var x=5;__private.set(["s1","value"],x)'
                );
                done();
            });
        });

        it('compile refs in inner functions scopes', function (done) {
            compile('test/qs/functions.qs', function (result) {
                assert.equal(
                    compact(result.ast.main.events.s1.change[1]._js),
                    'var x=5;(function(){__private.set(["s1","value"],x)}())'
                );
                done();
            });
        });

        it('respect function args', function (done) {
            compile('test/qs/functions.qs', function (result) {
                assert.equal(
                    compact(result.ast.main.events.s1.change[2]._js),
                    'console.log(e)'
                );
                done();
            });
        });

        it('inner scope primitive values', function (done) {
            compile('test/qs/functions.qs', function (result) {
                assert.equal(
                    compact(result.ast.main.events.s1.change[3]._js),
                    '__private.set(["nInner"],__private.get(["s1","value"]));' +
                    'console.log(__private.get(["nInner"]),__private.get(["nMain"]))'
                );
                done();
            });

        });

        it('comments', function (done) {
            compile('test/qs/functions.qs', function (result) {
                assert.equal(
                    compact(result.ast.main.events.s1.change[4]._js),
                    'if(true){var a}'
                );
                done();
            });

        });

        it('complicated quotes', function (done) {
            compile('test/qs/complicatedBraces.qs', function (result) {
                assert.equal(
                    compact(result.ast.Property.events.b1.click[0]._js),
                    'console.log(_self.get(["key"])+"=\\""+_self.get(["value"])+"\\"")'
                );
                done();
            });

        });
    });

})();