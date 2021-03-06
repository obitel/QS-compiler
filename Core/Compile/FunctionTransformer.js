/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * *
 */
;// QUOKKA 2017
// By zibx on 4/25/17.

module.exports = (function () {
    'use strict';
    //buildPipe.call(this, item.item.value, obj, whos, sm);
    var VariableExtractor = require('../JS/VariableExtractor'),
        ASTtransformer = require('../JS/ASTtransformer'),
        tools = require('./tools');
    var getName = function (el) {
        return el.name;
    };
    var transformer = {
        _functionTransform: function (fn, definedVars) {
            var vars = VariableExtractor.parse(fn),
                counter = 1,
                _self = this, i,
                undefinedVars = vars.getFullUnDefined(),

                intermediateVars = {},
                wereTransforms = false;

            definedVars = definedVars || {};

            for (i in definedVars)
                undefinedVars[i] = null;

            fn = new ASTtransformer().transform(vars.getAST(), undefinedVars, {
                escodegen: { format: { compact: true } },
                variableTransformer: function (node, stack) {
                    wereTransforms = true;

                    var crafted = ASTtransformer.craft.js(node),
                        sub, id = 'var' + (counter++);

                    //console.log('! ', crafted, node.type)
                    if (node.type === 'MemberExpression') {
                        var subDefinedVars = Object.create(definedVars),
                            deepestVar = stack[stack.length - 1].name;
                        subDefinedVars[deepestVar] = true;


                        //console.log('^^$ ')
                        sub = _self._functionTransform(ASTtransformer.craft.js(node), subDefinedVars, true);
                        //console.log('^^ '+sub)
                        intermediateVars[id] = sub;
                        typeof sub !== 'string' && (sub[deepestVar] = deepestVar);
                    } else {
                        intermediateVars[id] = ASTtransformer.craft.js(node);
                    }

                    return ASTtransformer.craft.Identifier(id);
                }
            });
            intermediateVars[' fn '] = fn;
            //console.log(intermediateVars);
            return intermediateVars;//wereTransforms?intermediateVars:fn;
        },
        functionTransform: function (fnObj, cls, child) {
            var meta = cls.metadata;
            var _self = this;
            var transformFnGet = function (node, stack, scope, parent) {
                var c0 = cls;
                var list = stack.slice().reverse(),
                    varParts;

                var info = tools.getVarInfo.call(_self, list, cls, child, scope);
                if(!info) {
                    throw new Error('Can not resolve '+
                        list.map(function(token){return token.name}).join('.') +
                        ' at (' + fnObj.fn.pointer+')')
                }
                var firstToken = info.varParts[0],
                    who;

                var what = cls.itemsInfo[info.varParts[0].name];

                    if (what.isPublic) {
                        who = ASTtransformer.craft.Identifier('_self');
                    } else {
                        who = ASTtransformer.craft.Identifier('__private');
                    }
                    /*
                        info.context--;
                        info.varParts.shift();

                        who = ASTtransformer.craft.Identifier(firstToken.name);
                    }*/

                    var beforeContext = [], afterContext = [], i, _i, item,
                        varItem;
                    varParts = info.varParts;

                    // need to keep context
                    if (info.context === false)
                        info.context = info.varParts.length - 1;

                    for (i = 0, _i = varParts.length; i < _i; i++) {
                        item = varParts[i];

                        if (item.node.computed) {
                            varItem = scope.doTransform.call(scope.me, item.node, scope.options);
                        } else {
                            varItem = {
                                'type': 'Literal',
                                'value': item.name,
                                'raw': '\'' + item.name + '\''
                            };
                            if ('_id' in item)
                                varItem._id = item._id;
                        }

                        if (i <= info.context)
                            beforeContext.push(varItem);
                        else
                            afterContext.push(item.node);
                    }

                    var c = ASTtransformer.craft, // craft short link
                        out;//
                    if (info.valueFlag)
                        if (!afterContext.length) {
                            beforeContext.push(c.Literal('value'));
                        } else {
                            afterContext.push(c.Literal('value')); // TODO
                        }

                    if (beforeContext.length)
                        out = c.CallExpression(who, 'get', beforeContext);
                    else
                        out = who;

                    /*if (info.valueFlag)
                     afterContext.push(c.Literal('value')); // TODO*/

                    for (i = 0, _i = afterContext.length; i < _i; i++)
                        out = c.MemberExpression(out, afterContext[i]);

                    return out;

                },
                transformFnSet = function (node, stack, scope) {
                    var c0 = cls;
                    var list = stack.slice().reverse(),
                        varParts,

                        info = tools.getVarInfo.call(_self, list, cls, child, scope);
                    var firstToken = info.varParts[0],
                        who;

                    //    first = list[0];
                    // var env = tools.isNameOfEnv(first.name, meta),
                    //     who;
                    var what = cls.itemsInfo[info.varParts[0].name];
                    if (what.isPublic) {
                        who = ASTtransformer.craft.Identifier('_self');
                    } else {
                        who = ASTtransformer.craft.Identifier('__private');
                    }

                    /*if (info.self) {
                        who = ASTtransformer.craft.Identifier('self');
                    } else {
                        info.context--;
                        info.varParts.shift();
                        who = info.thisFlag ? ASTtransformer.craft.This() : ASTtransformer.craft.Identifier(firstToken.name);
                    }*/
                    if (info.valueFlag)
                        info.varParts.push({name: 'value'})

                    return {
                        'type': 'CallExpression',
                        'callee': {
                            'type': 'MemberExpression',
                            'computed': false,
                            'object': who,
                            'property': {
                                'type': 'Identifier',
                                'name': 'set'
                            }
                        },
                        'arguments': [
                            {
                                'type': 'ArrayExpression',
                                'elements':
                                    info.varParts.map(function (item) {
                                        if (item.node && item.node.computed) {
                                            return scope.doTransform.call(scope.me, item.node, scope.options);
                                        } else {
                                            var out = {
                                                'type': 'Literal',
                                                'value': item.name,
                                                'raw': '\'' + item.name + '\''
                                            };
                                            if ('_id' in item)
                                                out._id = item._id;

                                            return out;
                                        }
                                    })
                            },
                            node.right
                        ]

                    };

                },
                options = {
                    variableTransformerSet: transformFnSet,
                    variableTransformerGet: transformFnGet,
                    basePointer: fnObj.fn.pointer
                },
                transformer = new ASTtransformer(),
                fn = fnObj.fn;

            fn = transformer.transform(fn.ast, fn.vars, options);
            return 'function(' + fnObj.args.map(getName).join(',') + '){\n' + fn + '\n}';
        }
    };
    var functionTransformer = function(item, obj, whos, sm){
        var body = transformer.functionTransform.call(this, {fn: item.body, args: item.arguments}, obj, whos)
        return body;
        
    };
    return functionTransformer;
})();