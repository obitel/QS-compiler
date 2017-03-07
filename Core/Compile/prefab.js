/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * *
 */
;// QUOKKA 2017
// By zibx on 3/6/17.

module.exports = (function () {
    'use strict';
    return {
        __compile: function(obj){
            var baseClassName = obj.extend[0];
            var source = [],
                i, ctor = [], props = [], cfg;



            source.push('var '+ obj.name +' = '+ baseClassName +
                '.extend(\'App'+baseClassName+'\', \''+obj.name+'\', {');


            ctor.push('ctor: function(){');
            
            //obj.public
            
            ctor.push('}');
            for(i in obj.public){
                props.push(i+':{}')
            }
            ctor = ctor.join('\n');
            props = '_prop: {\n'+props.join(',\n')+'\n}\n';



            cfg = [ctor, props];

            source.push(cfg.join(','));



            source.push('});');




            console.log(source.join('\n'));
            debugger;
        }
    };
})();