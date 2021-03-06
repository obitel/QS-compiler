/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * *
 */
;// QUOKKA 2017
// By zibx on 3/29/17.

module.exports = (function () {
    'use strict';
    var exclude = {
        'node_modules': true
    };
    var fs = require('fs'),
        path = require('path')
        ;
    var showHelp;
    //var console = new (require('./console'))('build');
    function readDirRecursive(dir) {
        //console.log('Read', dir)
        var entries = fs.readdirSync(dir);
        var ret = [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if(entry.indexOf('.') === 0 || exclude[entry])
                continue;

            var fullPath = path.join(dir, entry);
            var stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                /*if (entry == "TypeTable.js")
                 ret.push("module.exports.TypeTable=require('../" + fullPath.replace(/\\/g, "/") + "')");
                 else*/
                ret.push(fullPath.replace(/\\/g, "/"));
            }
            if (stat.isDirectory()) {
                ret = ret.concat(readDirRecursive(fullPath));
            }
        }
        return ret;
    };
    var options = {
        lib: {
            short: 'l',
            info: 'standard library directory. Is relative to basePath'
        },
        typeTable: {
            short: 't',
            info: 'path to typeTable relative to lib directory. Type table is required to resolve namespaces'
        },
        build: {
            short: 'b',
            info: 'path to qs relative to basePath'
        },
        basePath: {
            short: 'p',
            info: 'base path',
            value: 'current path'
        },
        output: {
            short: 'o',
            info: 'output path. Relative to basePath'
        },
        verbose: {
            short: 'v',
            info: 'show debug logging'
        },
        config: {
            short: 'c',
            info: 'config path. Config can contain any property from this list'
        },
        main: {
            short: 'm',
            info: 'main object. Entry point of project'
        }
    };

    var build = function build(cfg, callback){
        var config, i, opt, _i;

        for(i in options){
            opt = options[i];
            if(opt.short)
                cfg[i] = cfg[i] || cfg[opt.short];
        }

        /** LOAD CONFIG */
        if(!cfg.config){
            //showHelp('No config file specified');
            config = cfg;
        }else {
            try {
                config = Object.assign({}, JSON.parse(fs.readFileSync(cfg.config) + ''), cfg);
            } catch (e) {
                showHelp('JSON config is corrupted or not exists (' + cfg.config + ')', e)
            }
            console.log('JSON config parsed ('+config.config+')');
        }


        if(!('lib' in config)){
            showHelp('lib dir is not specified in config');
        }


        var libCache = {};

        if(config.lib) {
            if(!Array.isArray(config.lib)){
                config.lib = [config.lib];
            }

            /** LOAD TYPE TABLE */
            var typeTable;
            if (!config.typeTable) {
                showHelp('type table dir is not specified in config');
            }

            if(typeof config.typeTable === 'object') {
                typeTable = config.typeTable;
            }else{
                var typeTableDir = path.resolve(config.basePath || __dirname, config.lib[0], config.typeTable);
                try {
                    typeTable = require(typeTableDir);
                } catch (e) {
                    showHelp('Can not load type table ' + typeTableDir, e)
                }
            }
            var currentFile;

            for(i = 0, _i = config.lib.length; i < _i; i++) {

                var lib = config.lib[i];
                /** READ ALL MODULES OF LIB */
                var libDir = path.resolve(config.basePath || __dirname, lib);

                try {
                    var files = readDirRecursive(libDir);
                } catch (e) {
                    showHelp('Error reading directory (' + libDir + ')', e);
                }

                config.verbose && console.log('List of lib files in ' + lib + ': ' + files.map(function (filePath) {
                        return path.basename(filePath);
                    }).join(', '));

                /** LOAD LIB MODULES */
                var classes = {};
                files.forEach(function (filePath) {
                    try {
                        currentFile = filePath;
                        classes[filePath] = require(filePath);
                    } catch (e) {
                        showHelp('Can not load module ' + filePath, e)
                    }
                });
                if(typeof QRequire !== 'undefined')
                    files.forEach(function (filePath) {
                        if(classes[filePath] instanceof QRequire.Waiter) {
                            var c = classes[filePath] = classes[filePath].res;
                            if(Array.isArray(c)){
                                c.forEach(function(c){
                                    libCache[c.name] = c;
                                });
                            }else {
                                libCache[c.name] = c;
                            }
                        }
                    });
            }





        }
        /** TRY BUILDING */
        var tokenizer = require('./Core/Tokenizer'),
            lexer = require('./Core/Preprocess'),
            Compiler = require('./Core/Compile/Compiler');
        if(config.build) {
            if(!Array.isArray(config.build))
                config.build = [config.build];

            var sourcePaths = config.build.map(function(buildPath){
                return path.resolve(config.basePath || __dirname, buildPath);
            });
            var data = sourcePaths.map(function(sourcePath, i){
               // debugger;
                if(config.fileGetter){
                    return config.fileGetter(config.build[i]);
                }else
                    return (fs.readFileSync(sourcePath) + '');
            });
            
        }else if(config.source){
            sourcePaths = ['inline'];
            data = [config.source];
        }else{
            showHelp('Specify `build` option or give source' + typeTableDir)
        }

        data = data.map(function(data){
            return data.replace(/\r/g, '');
        });

        var lexes = sourcePaths.map(function(sourcePath, i){
            var tokens = tokenizer(data[i], sourcePath),
                lex = lexer(tokens);
            return lex;
        });
        var lex = [].concat.apply([],lexes);

        var compiler  = new Compiler({
            ns: config.ns,
            searchDeps: function (fileNames) {

                var i, _i, fileName, matched;
                for(i = fileNames.length - 1; i >= 0; i--){
                    fileName = fileNames[i];
                    if(libCache[fileName]){
                        matched = [libCache[fileName]];
                        matched[0].ctor = matched[0];
                    } else {
                        try {
                            matched = typeTable.search(fileName);
                        }catch(e){
                            throw new Error('Error matching `' + fileName + '`')
                        }
                    }


                    if(matched.length){
                        if(matched.length === 1){
                            //console.log(matched[0]);
                            compiler.addNative(matched[0]);
                            var parent = matched[0].parent;
                            if(parent)
                                this.searchDeps([parent.name]);
                            //console.log('Dep resolved ', fileName, matched[0].namespace)
                        }else{
                            throw new Error('TOO COMPLEX (сложна)');
                        }
                    }
                }


            }
        });



        lexes.forEach(function(lex){
            lex.forEach(function(item){
                compiler.add(item);
            });
        });

        lex.forEach(function(lex){
            var name = lex.name.data;
            compiler.world[name].namespace = config.ns;
        });

        if(!config.main){
            if(lex.length === 1){
                config.main = lex[0].name.data;
            }else{
                var filtered = lex.filter(function(el){
                    return el.extend[0].data !== 'UIComponent';
                });
                if(filtered.length === 1){
                    config.main = filtered[0].name.data;
                }else{
                    showHelp('Please specify main object')
                }
            }
        }

        var mainObj = config.main || 'main';

        var asts = {};
        asts[mainObj] = compiler.world[mainObj];
        var result = compiler.compile(mainObj, {sourceMap: true, newWay: config.newWay, ns: config.ns}),
            finalSource = lexes.map(function(lex, i){
                return '//'+ sourcePaths[i] +'\n' +lex.map(function(item) {
                    asts[item.name.data] = compiler.world[item.name.data];
                    return mainObj !== item.name.data ? compiler.compile(item.name.data, {sourceMap: true, newWay: config.newWay, ns: config.ns}).source : ''
                }).join('\n\n');
            }).join('\n\n') + result.source;


        //console.log('Compiled')


        if(!config.output){
            //console.log(finalSource);
            typeof callback === 'function' && callback({
                ast: asts, js: finalSource, lex: [].concat.apply([],lexes), world: compiler.world, main: mainObj
            });
        }else{
            if(typeof config.output === 'string'){
                /* lets predict! */
                var parsed = path.parse(config.output);
                if(!parsed.ext){
                    config.output = {basePath: config.output};
                }else{
                    config.output = {
                        basePath: parsed.dir,
                        fileName: config.output
                    };
                }
            }
            var outputBase;
            if('basePath' in config.output){
                outputBase = config.output.basePath;
            }else{
                outputBase = config.basePath || __dirname;
            }

            var buildResults = config.build.map(function(buildPath, i){
                var fileName = path.basename(buildPath);
                var outputPath = path.resolve(
                    outputBase,
                        config.output.fileName || (path.parse(fileName).name+'.js')
                    ),
                    mapPath = path.resolve(
                            outputBase,
                            config.output.mapFileName || (path.parse(fileName).name+'.map')
                        )+(config.ext||''),
                    qsPath = path.resolve(
                            outputBase,
                            config.output.qsFileName || (fileName)
                        )+(config.ext||'');
                var getLine = '';
                if(config.get){
                    getLine = '?'+require('querystring').stringify(config.get);
                }
                fs.writeFileSync(outputPath, finalSource+'\n' +
                    '//# sourceMappingURL='+path.relative(outputBase, mapPath)+getLine+'\n'+
                    '//# sourceURL='+path.relative(outputBase, qsPath)+getLine);

                var map = JSON.parse(result.map);
                map.sources = [path.relative(outputBase, qsPath)];


                fs.writeFileSync(mapPath, JSON.stringify(map));
                fs.writeFileSync(qsPath, data[i]);
                return {
                    outputPath: outputPath,
                    lex: lexes[i]
                };
            });


            typeof callback === 'function' && callback({
                outputPath: buildResults.map((r)=>r.outputPath),
                ast: asts,
                js: finalSource,
                lex: [].concat.apply([],lexes),
                world: compiler.world,
                main: mainObj
            });
            console.log('OUTPUT: '+ buildResults.map((r)=>r.outputPath))
        }
        //typeTable.search('Timer'))
        
        
        //console.log(config);
        //console.dir(cfg);
    };

    if(module.parent){

        showHelp = function(error, e){
            throw new Error(error+(e?'\n'+e+'\n'+e.stack:''));
        };
    }else{
        showHelp = function(error, more){
            console.log('Error: '+(error||'Unknown'));
            if(more)
                console.log(more);
            console.log('node build -c ******.json -fd');
            process.exit();
        };
        build(require('minimist')(process.argv.slice(2)));
    }

    return build;
})();